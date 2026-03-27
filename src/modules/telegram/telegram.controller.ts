import { Request, Response } from 'express';
import { getMe, sendMessage } from './telegram.service';
import { isPollingActive } from './telegram.webhook';
import { checkPendingReminders } from './telegram.reminder';
import { config } from '../../config';
import { logger } from '../../lib/logger';

/**
 * GET /api/telegram/status — Bot status
 */
export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    const botInfo = await getMe();
    res.json({
      error_code: 0,
      error_message: 'ok',
      data: {
        bot: botInfo,
        polling: isPollingActive(),
        ownerChatId: config.telegram.ownerChatId,
        reminderIntervalHours: config.telegram.reminderIntervalHours,
      },
    });
  } catch (err) {
    logger.error('Failed to get bot status', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      error_code: 500,
      error_message: 'Failed to get bot status',
    });
  }
}

/**
 * POST /api/telegram/test — Send test message to owner
 */
export async function sendTestMessage(_req: Request, res: Response): Promise<void> {
  try {
    const msg = await sendMessage(
      config.telegram.ownerChatId,
      [
        '🧪 Test message from Zalo Forwarder',
        '━━━━━━━━━━━━━━━',
        `🤖 Bot: @Tukinga_Unicon_Forwarder_Bot`,
        `⏰ Time: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
        `📊 Polling: ${isPollingActive() ? '✅ Active' : '❌ Inactive'}`,
        '',
        'Nếu bạn nhận được tin nhắn này, bot đang hoạt động bình thường! 🎉',
      ].join('\n'),
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Test Confirm', callback_data: 'test:confirm' },
              { text: '❌ Test Reject', callback_data: 'test:reject' },
            ],
          ],
        },
      },
    );

    if (msg) {
      res.json({
        error_code: 0,
        error_message: 'Test message sent',
        data: { message_id: msg.message_id },
      });
    } else {
      res.status(500).json({
        error_code: 500,
        error_message: 'Failed to send test message. Make sure the owner has started a conversation with the bot first (send /start to @Tukinga_Unicon_Forwarder_Bot on Telegram).',
      });
    }
  } catch (err) {
    logger.error('Failed to send test message', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      error_code: 500,
      error_message: 'Failed to send test message',
    });
  }
}

/**
 * POST /api/telegram/webhook — Receive Telegram updates via webhook (alternative to polling)
 */
export async function handleWebhookUpdate(req: Request, res: Response): Promise<void> {
  // For now, we use long polling. This endpoint is a placeholder for webhook mode.
  logger.debug('Received webhook update', { body: req.body });
  res.json({ ok: true });
}

/**
 * POST /api/telegram/remind — Manually trigger reminder check
 */
export async function triggerReminder(_req: Request, res: Response): Promise<void> {
  try {
    const count = await checkPendingReminders();
    res.json({
      error_code: 0,
      error_message: 'ok',
      data: { pendingReminded: count },
    });
  } catch (err) {
    logger.error('Failed to trigger reminder', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      error_code: 500,
      error_message: 'Failed to trigger reminder check',
    });
  }
}
