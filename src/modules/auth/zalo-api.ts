/**
 * Raw Zalo API calls — ported from Python utils.py
 * Implements all login steps:
 *   1. getCookie (za.zalo.me tracking + id.zalo.me session)
 *   2. generateQr (id.zalo.me QR generation)
 *   3. waitingScan (poll for QR scan)
 *   4. waitingConfirm (poll for user confirm on phone)
 *   5. checkLogin (id.zalo.me session check + redirect follow)
 *   6. checkUserInfo (jr.chat.zalo.me user info)
 *   7. checkT (za.zalo.me tracking post-login)
 *   8. getServerInfo + getLoginInfo (wpa.chat.zalo.me)
 */

import { config } from '../../config';
import { logger } from '../../lib/logger';
import { httpRequest, followRedirectChain } from '../../lib/http-client';
import { getSignKey } from '../../lib/crypto';
import {
  ZaloCookie,
  extractCookies,
  mergeCookieLists,
  getCookiesByDomain,
} from '../../lib/cookie-manager';
import {
  ZaloQrResponse,
  ZaloWaitingScanResponse,
  ZaloWaitingConfirmResponse,
  ZaloLoginInfoResponse,
} from '../../types/zalo';

const { userAgent, zpwType, clientVersion, computerName, qrVersion } = config.zalo;

// =============================================================================
// Step 1: Get initial cookies
// =============================================================================

export async function getCookies(): Promise<ZaloCookie[] | null> {
  let cookies: ZaloCookie[] = [];

  try {
    // First: tracking request to za.zalo.me
    const currentTimestamp = Date.now();
    const payload = `zl=https%3A%2F%2Fchat.zalo.me%2F&zrf=&zch=UTF-8&zts=${currentTimestamp}&zos=Windows&zla=en-US%2Cen-US%2Cen&__zi=null&v=2312131603&incog=false&zact=pv&_zapp=&_zidnbaid=`;

    const trackingResp = await httpRequest({
      url: 'https://za.zalo.me/v3/w/t',
      method: 'POST',
      headers: {
        'authority': 'za.zalo.me',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://chat.zalo.me',
        'referer': 'https://chat.zalo.me/',
      },
      body: payload,
    });

    cookies = trackingResp.cookies;
  } catch (ex) {
    logger.error('Failed to get tracking cookies', { error: ex });
  }

  try {
    // Second: session request to id.zalo.me
    const idResp = await httpRequest({
      url: 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
      method: 'GET',
      headers: {
        'authority': 'id.zalo.me',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'referer': 'https://chat.zalo.me/',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      cookies,
    });

    return mergeCookieLists(cookies, idResp.cookies);
  } catch (ex) {
    logger.error('Failed to get session cookies', { error: ex });
    return null;
  }
}

// =============================================================================
// Step 2: Generate QR code
// =============================================================================

export async function generateQr(cookies: ZaloCookie[]): Promise<ZaloQrResponse | null> {
  try {
    const payload = `continue=https%3A%2F%2Fchat.zalo.me%2F&v=${qrVersion}`;

    const resp = await httpRequest({
      url: 'https://id.zalo.me/account/authen/qr/generate',
      method: 'POST',
      headers: {
        'authority': 'id.zalo.me',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://id.zalo.me',
        'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
        'sec-fetch-site': 'same-origin',
      },
      cookies,
    });

    return resp.json<ZaloQrResponse>();
  } catch (ex) {
    logger.error('Failed to generate QR', { error: ex });
    return null;
  }
}

// =============================================================================
// Step 3: Wait for QR scan
// =============================================================================

export async function waitingScan(
  cookies: ZaloCookie[],
  code: string,
): Promise<ZaloWaitingScanResponse | null> {
  try {
    const payload = `code=${code}&continue=https%3A%2F%2Fchat.zalo.me%2F&v=${qrVersion}`;

    const resp = await httpRequest({
      url: 'https://id.zalo.me/account/authen/qr/waiting-scan',
      method: 'POST',
      headers: {
        'authority': 'id.zalo.me',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://id.zalo.me',
        'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
        'sec-fetch-site': 'same-origin',
      },
      body: payload,
      cookies,
    });

    if (resp.status === 200) {
      return resp.json<ZaloWaitingScanResponse>();
    }
    return null;
  } catch (ex) {
    logger.error('Failed waiting for scan', { error: ex });
    return null;
  }
}

// =============================================================================
// Step 4: Wait for confirm
// =============================================================================

export async function waitingConfirm(
  cookies: ZaloCookie[],
  code: string,
): Promise<{ response: ZaloWaitingConfirmResponse | null; cookies: ZaloCookie[] }> {
  try {
    const payload = `code=${code}&gToken=&gAction=CONFIRM_QR&continue=https%3A%2F%2Fchat.zalo.me%2F&v=${qrVersion}`;

    const resp = await httpRequest({
      url: 'https://id.zalo.me/account/authen/qr/waiting-confirm',
      method: 'POST',
      headers: {
        'authority': 'id.zalo.me',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://id.zalo.me',
        'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
        'sec-fetch-site': 'same-origin',
      },
      body: payload,
      cookies,
    });

    if (resp.status === 200) {
      return {
        response: resp.json<ZaloWaitingConfirmResponse>(),
        cookies: resp.cookies,
      };
    }
    return { response: null, cookies: [] };
  } catch (ex) {
    logger.error('Failed waiting for confirm', { error: ex });
    return { response: null, cookies: [] };
  }
}

// =============================================================================
// Step 5: Check login (follow redirects, collect cookies)
// =============================================================================

export async function checkLogin(
  cookies: ZaloCookie[],
): Promise<{ success: boolean; cookies: ZaloCookie[] | null }> {
  try {
    const resp = await httpRequest({
      url: 'https://id.zalo.me/account/checksession?continue=https%3A%2F%2Fchat.zalo.me%2F',
      method: 'GET',
      headers: {
        'authority': 'id.zalo.me',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'referer': 'https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'upgrade-insecure-requests': '1',
      },
      cookies,
      followRedirects: false,
    });

    if (resp.status === 302) {
      const location = resp.headers.get('location');
      if (location) {
        const updatedCookies = mergeCookieLists(cookies, resp.cookies);
        const finalCookies = await followRedirectChain(location, updatedCookies);
        return { success: true, cookies: finalCookies };
      }
    }

    if (resp.status === 200) {
      return { success: true, cookies: mergeCookieLists(cookies, resp.cookies) };
    }

    return { success: false, cookies: null };
  } catch (ex) {
    logger.error('Failed checkLogin', { error: ex });
    return { success: false, cookies: null };
  }
}

// =============================================================================
// Step 6: Check user info
// =============================================================================

export async function checkUserInfo(cookies: ZaloCookie[]): Promise<boolean> {
  try {
    const resp = await httpRequest({
      url: 'https://jr.chat.zalo.me/jr/userinfo',
      method: 'GET',
      headers: {
        'authority': 'jr.chat.zalo.me',
        'accept': '*/*',
        'origin': 'https://chat.zalo.me',
        'referer': 'https://chat.zalo.me/',
      },
      cookies,
    });

    return resp.status === 200;
  } catch (ex) {
    logger.error('Failed checkUserInfo', { error: ex });
    return false;
  }
}

// =============================================================================
// Step 7: Check T (tracking)
// =============================================================================

export async function checkT(cookies: ZaloCookie[]): Promise<boolean> {
  try {
    const currentTimestamp = Date.now();
    const domainCookies = getCookiesByDomain(cookies, 'za.zalo.me');
    const zi = domainCookies['__zi'] || '';

    const payload = `zl=https%3A%2F%2Fchat.zalo.me%2F&zrf=https%3A%2F%2Fid.zalo.me%2F&zch=UTF-8&zts=${currentTimestamp}&zos=Windows&zla=en-US%2Cen-US%2Cen&__zi=${zi}&v=2312131603&incog=false&zact=pv&_zapp=&_zidnbaid=`;

    const resp = await httpRequest({
      url: 'https://za.zalo.me/v3/w/t',
      method: 'POST',
      headers: {
        'authority': 'za.zalo.me',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://chat.zalo.me',
        'referer': 'https://chat.zalo.me/',
      },
      body: payload,
      cookies,
    });

    return resp.status === 200;
  } catch (ex) {
    logger.error('Failed checkT', { error: ex });
    return false;
  }
}

// =============================================================================
// Step 8a: Get server info
// =============================================================================

export function generateServerInfoUrl(imei: string): string {
  const typeWeb = parseInt(zpwType, 10);
  const signkey = getSignKey('getserverinfo', {
    imei,
    type: typeWeb,
    client_version: clientVersion,
    computer_name: computerName,
  });

  return `https://wpa.chat.zalo.me/api/login/getServerInfo?imei=${imei}&type=${typeWeb}&client_version=${clientVersion}&computer_name=${computerName}&signkey=${signkey}`;
}

export async function getServerInfo(
  url: string,
  cookies: ZaloCookie[],
): Promise<{ success: boolean; data?: unknown }> {
  try {
    const resp = await httpRequest({
      url,
      method: 'GET',
      headers: {
        'authority': 'wpa.chat.zalo.me',
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://chat.zalo.me',
        'referer': 'https://chat.zalo.me/',
      },
      cookies,
    });

    if (resp.status === 200) {
      return { success: true, data: resp.json() };
    }
    return { success: false };
  } catch (ex) {
    logger.error('Failed getServerInfo', { error: ex });
    return { success: false };
  }
}

// =============================================================================
// Step 8b: Get login info
// =============================================================================

export async function getLoginInfo(
  cookies: ZaloCookie[],
  imei: string,
): Promise<{ success: boolean; data?: ZaloLoginInfoResponse }> {
  try {
    const currentTimestamp = Date.now();
    const url = `https://wpa.chat.zalo.me/api/login/getLoginInfo?zpw_ver=68&zpw_type=${zpwType}&imei=${imei}&computer_name=${computerName}&language=vi&ts=${currentTimestamp}&nretry=0`;

    const resp = await httpRequest({
      url,
      method: 'GET',
      headers: {
        'authority': 'wpa.chat.zalo.me',
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://chat.zalo.me',
        'referer': 'https://chat.zalo.me/',
      },
      cookies,
    });

    if (resp.status === 200) {
      return { success: true, data: resp.json<ZaloLoginInfoResponse>() };
    }
    return { success: false };
  } catch (ex) {
    logger.error('Failed getLoginInfo', { error: ex });
    return { success: false };
  }
}
