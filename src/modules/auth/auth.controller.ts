import { Request, Response } from 'express';
import { logger } from '../../lib/logger';
import * as authService from './auth.service';

/**
 * POST /api/auth/qr/generate
 * Generate a QR code for Zalo login
 */
export async function generateQr(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.generateQr();
    res.json({
      error_code: 0,
      error_message: 'Success',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('generateQr failed', { error: message });
    res.status(500).json({
      error_code: 1,
      error_message: message,
    });
  }
}

/**
 * POST /api/auth/qr/wait-scan
 * Wait for QR code to be scanned
 * Body: { accountId, code }
 */
export async function waitScan(req: Request, res: Response): Promise<void> {
  try {
    const { accountId, code } = req.body as { accountId?: string; code?: string };
    if (!accountId || !code) {
      res.status(400).json({
        error_code: 1,
        error_message: 'accountId and code are required',
      });
      return;
    }

    const result = await authService.waitForScan(accountId, code);
    res.json({
      error_code: 0,
      error_message: 'Success',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('waitScan failed', { error: message });
    res.status(500).json({
      error_code: 1,
      error_message: message,
    });
  }
}

/**
 * POST /api/auth/qr/wait-confirm
 * Wait for user to confirm on phone
 * Body: { accountId, code }
 */
export async function waitConfirm(req: Request, res: Response): Promise<void> {
  try {
    const { accountId, code } = req.body as { accountId?: string; code?: string };
    if (!accountId || !code) {
      res.status(400).json({
        error_code: 1,
        error_message: 'accountId and code are required',
      });
      return;
    }

    const result = await authService.waitForConfirm(accountId, code);
    res.json({
      error_code: 0,
      error_message: 'Success',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('waitConfirm failed', { error: message });
    res.status(500).json({
      error_code: 1,
      error_message: message,
    });
  }
}

/**
 * POST /api/auth/qr/complete
 * Complete the login flow (get server info + login info)
 * Body: { accountId, code }
 */
export async function completeLogin(req: Request, res: Response): Promise<void> {
  try {
    const { accountId, code } = req.body as { accountId?: string; code?: string };
    if (!accountId || !code) {
      res.status(400).json({
        error_code: 1,
        error_message: 'accountId and code are required',
      });
      return;
    }

    const result = await authService.completeLogin(accountId, code);
    res.json({
      error_code: 0,
      error_message: 'Success',
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('completeLogin failed', { error: message });
    res.status(500).json({
      error_code: 1,
      error_message: message,
    });
  }
}

/**
 * POST /api/auth/disconnect/:id
 * Disconnect an account
 */
export async function disconnectAccount(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    if (!id) {
      res.status(400).json({
        error_code: 1,
        error_message: 'Account ID is required',
      });
      return;
    }

    await authService.disconnect(id);
    res.json({
      error_code: 0,
      error_message: 'Account disconnected',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('disconnect failed', { error: message });
    res.status(500).json({
      error_code: 1,
      error_message: message,
    });
  }
}
