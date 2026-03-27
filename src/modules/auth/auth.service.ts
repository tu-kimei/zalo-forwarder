/**
 * Auth Service — orchestrates the Zalo QR login flow.
 * Manages account state in the database through Prisma.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../lib/logger';
import { generateImei } from '../../lib/crypto';
import { mergeCookieLists, ZaloCookie } from '../../lib/cookie-manager';
import { config } from '../../config';
import * as zaloApi from './zalo-api';

const prisma = new PrismaClient();

export interface QrGenerateResult {
  accountId: string;
  image: string;
  code: string;
  token: string;
}

export interface ScanResult {
  status: string;
  avatar?: string;
  displayName?: string;
  code?: string;
  token?: string;
}

export interface CompleteResult {
  accountId: string;
  zaloUid?: string;
  phoneNumber?: string;
  displayName?: string;
  status: string;
}

/** Helper: cast ZaloCookie[] to Prisma Json value */
function cookiesToJson(cookies: ZaloCookie[]): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(cookies));
}

/** Helper: cast object to Prisma Json value */
function toJson(obj: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(obj));
}

/** Helper: read cookies from DB record */
function readCookies(account: { cookies: Prisma.JsonValue | null }): ZaloCookie[] {
  if (!account.cookies) return [];
  return account.cookies as unknown as ZaloCookie[];
}

// ─── Generate QR ──────────────────────────────────────────────────────────

export async function generateQr(): Promise<QrGenerateResult> {
  // Step 1: Get initial cookies
  const cookies = await zaloApi.getCookies();
  if (!cookies) {
    throw new Error('Failed to get initial cookies from Zalo');
  }

  // Step 2: Generate QR
  const qrResponse = await zaloApi.generateQr(cookies);
  if (!qrResponse || qrResponse.error_code !== 0 || !qrResponse.data) {
    throw new Error(`Failed to generate QR: ${qrResponse?.error_message || 'unknown'}`);
  }

  const { image, code, token } = qrResponse.data;
  const imei = generateImei(config.zalo.userAgent);

  // Create account record in DB
  const account = await prisma.zaloAccount.create({
    data: {
      cookies: cookiesToJson(cookies),
      imei,
      userAgent: config.zalo.userAgent,
      status: 'QR_GENERATED',
      loginInfo: toJson({ code, token }),
    },
  });

  logger.info('QR code generated', { accountId: account.id, code });

  return {
    accountId: account.id,
    image,
    code,
    token,
  };
}

// ─── Wait for Scan ────────────────────────────────────────────────────────

export async function waitForScan(accountId: string, code: string): Promise<ScanResult> {
  const account = await prisma.zaloAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'QR_GENERATED') {
    throw new Error(`Invalid status for scan: ${account.status}`);
  }

  const cookies = readCookies(account);
  const scanResponse = await zaloApi.waitingScan(cookies, code);

  if (!scanResponse) {
    throw new Error('Failed to check scan status');
  }

  if (scanResponse.error_code !== 0) {
    return { status: 'waiting' };
  }

  // Status 4 means QR expired/refreshed, new code provided
  if (scanResponse.data?.status === 4) {
    await prisma.zaloAccount.update({
      where: { id: accountId },
      data: {
        loginInfo: toJson({
          code: scanResponse.data.code,
          token: scanResponse.data.token,
        }),
      },
    });

    return {
      status: 'refreshed',
      code: scanResponse.data.code,
      token: scanResponse.data.token,
    };
  }

  // Scanned successfully
  if (scanResponse.data?.avatar || scanResponse.data?.display_name) {
    await prisma.zaloAccount.update({
      where: { id: accountId },
      data: {
        avatar: scanResponse.data.avatar,
        displayName: scanResponse.data.display_name,
        status: 'SCANNED',
      },
    });

    return {
      status: 'scanned',
      avatar: scanResponse.data.avatar,
      displayName: scanResponse.data.display_name,
    };
  }

  return { status: 'waiting' };
}

// ─── Wait for Confirm + Complete Login ────────────────────────────────────

export async function waitForConfirm(accountId: string, code: string): Promise<ScanResult> {
  const account = await prisma.zaloAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'SCANNED') {
    throw new Error(`Invalid status for confirm: ${account.status}`);
  }

  let cookies = readCookies(account);

  // Step 4: Wait for confirm
  const { response: confirmResp, cookies: confirmCookies } = await zaloApi.waitingConfirm(cookies, code);
  if (!confirmResp) {
    throw new Error('Failed to get confirm response');
  }

  cookies = mergeCookieLists(cookies, confirmCookies);

  // Step 5: Check login (follow redirects)
  const { success: loginSuccess, cookies: loginCookies } = await zaloApi.checkLogin(cookies);
  if (!loginSuccess || !loginCookies) {
    throw new Error('Login check failed');
  }

  cookies = mergeCookieLists(cookies, loginCookies);

  // Update cookies
  await prisma.zaloAccount.update({
    where: { id: accountId },
    data: {
      cookies: cookiesToJson(cookies),
      status: 'CONFIRMED',
    },
  });

  return { status: 'confirmed' };
}

// ─── Complete Login (get server info + login info) ────────────────────────

export async function completeLogin(accountId: string, code: string): Promise<CompleteResult> {
  const account = await prisma.zaloAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');
  if (!['SCANNED', 'CONFIRMED'].includes(account.status)) {
    throw new Error(`Invalid status for complete: ${account.status}`);
  }

  let cookies = readCookies(account);
  const imei = account.imei!;

  // If not yet confirmed, do confirm flow first
  if (account.status === 'SCANNED') {
    const { response: confirmResp, cookies: confirmCookies } = await zaloApi.waitingConfirm(cookies, code);
    if (!confirmResp) throw new Error('Confirm failed');
    cookies = mergeCookieLists(cookies, confirmCookies);

    const { success, cookies: loginCookies } = await zaloApi.checkLogin(cookies);
    if (!success || !loginCookies) throw new Error('Login check failed');
    cookies = mergeCookieLists(cookies, loginCookies);
  }

  // Step 6: Check user info
  await zaloApi.checkUserInfo(cookies);

  // Step 7: Check T
  await zaloApi.checkT(cookies);

  // Step 8a: Get server info
  const serverInfoUrl = zaloApi.generateServerInfoUrl(imei);
  const serverResult = await zaloApi.getServerInfo(serverInfoUrl, cookies);
  if (!serverResult.success) {
    throw new Error('Failed to get server info');
  }

  // Step 8b: Get login info
  const loginInfoResult = await zaloApi.getLoginInfo(cookies, imei);
  if (!loginInfoResult.success || !loginInfoResult.data) {
    throw new Error('Failed to get login info');
  }

  const loginData = loginInfoResult.data;

  // Update account with full login info
  const updatedAccount = await prisma.zaloAccount.update({
    where: { id: accountId },
    data: {
      accountId: loginData.data?.uid,
      phoneNumber: loginData.data?.phone_number,
      cookies: cookiesToJson(cookies),
      loginInfo: toJson(loginData),
      zpwEnk: loginData.data?.zpw_enk,
      status: 'ACTIVE',
      lastHealthCheck: new Date(),
    },
  });

  // Deactivate other sessions for the same Zalo account
  if (loginData.data?.uid) {
    await prisma.zaloAccount.updateMany({
      where: {
        accountId: loginData.data.uid,
        id: { not: accountId },
      },
      data: { status: 'INACTIVE' },
    });
  }

  logger.info('Login complete', {
    accountId,
    zaloUid: loginData.data?.uid,
    displayName: updatedAccount.displayName,
  });

  return {
    accountId,
    zaloUid: loginData.data?.uid,
    phoneNumber: loginData.data?.phone_number,
    displayName: updatedAccount.displayName || undefined,
    status: 'ACTIVE',
  };
}

// ─── Disconnect ──────────────────────────────────────────────────────────

export async function disconnect(accountId: string): Promise<void> {
  await prisma.zaloAccount.update({
    where: { id: accountId },
    data: { status: 'INACTIVE' },
  });
  logger.info('Account disconnected', { accountId });
}
