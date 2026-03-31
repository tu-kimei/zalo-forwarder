import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { sendMessage, InlineKeyboardMarkup } from './telegram.service';
import { checkUniconStatus } from './unicon-status';

const prisma = new PrismaClient();

let reminderInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Check for pending OCR results older than reminderIntervalHours
 * and send reminder messages to the owner.
 */
export async function checkPendingReminders(): Promise<number> {
  const thresholdMs = config.telegram.reminderIntervalHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);

  try {
    // Find pending results older than threshold where we haven't sent
    // a reminder in the last reminderIntervalHours
    const pendingResults = await prisma.ocrResult.findMany({
      where: {
        status: 'pending',
        createdAt: { lt: cutoff },
        OR: [
          { reminderSentAt: null },
          { reminderSentAt: { lt: cutoff } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 20, // Don't spam too many at once
    });

    if (pendingResults.length === 0) return 0;

    // Cross-check each result against unicon_schedule.
    // If status changed in UI, sync it back to OcrResult and skip reminder.
    const stillPending: typeof pendingResults = [];

    for (const ocr of pendingResults) {
      const uniconStatus = await checkUniconStatus(ocr.id, ocr.category as 'fuel' | 'repair');

      if (uniconStatus && uniconStatus !== 'pending') {
        await prisma.ocrResult.update({
          where: { id: ocr.id },
          data: {
            status: uniconStatus,
            reviewedAt: new Date(),
            reviewNote: 'Auto-synced from UI before reminder',
          },
        });
        logger.info('OcrResult status synced from UI before reminder', {
          ocrResultId: ocr.id,
          oldStatus: 'pending',
          newStatus: uniconStatus,
        });
      } else {
        stillPending.push(ocr);
      }
    }

    if (stillPending.length === 0) {
      logger.info('No reminders to send after UI cross-check', {
        checked: pendingResults.length,
        synced: pendingResults.length,
      });
      return 0;
    }

    // Group by category for a summary message
    const fuelCount = stillPending.filter((r) => r.category === 'fuel').length;
    const repairCount = stillPending.filter((r) => r.category === 'repair').length;

    const lines = [
      '⏰ Nhắc nhở: Có kết quả OCR chưa xử lý',
      '━━━━━━━━━━━━━━━',
      `📊 Tổng: ${stillPending.length} phiếu chờ duyệt`,
    ];

    if (fuelCount > 0) lines.push(`  ⛽ Đổ dầu: ${fuelCount}`);
    if (repairCount > 0) lines.push(`  🔧 Sửa chữa: ${repairCount}`);

    lines.push('');

    // List individual items (up to 10)
    const shown = stillPending.slice(0, 10);
    for (const ocr of shown) {
      const data = (ocr.extractedData ?? {}) as Record<string, unknown>;
      const plate = (data.licensePlate as string) ?? '—';
      const icon = ocr.category === 'fuel' ? '⛽' : '🔧';
      const age = Math.round((Date.now() - ocr.createdAt.getTime()) / 3600000);
      lines.push(`${icon} ${plate} — ${age}h trước`);
    }

    if (stillPending.length > 10) {
      lines.push(`... và ${stillPending.length - 10} phiếu khác`);
    }

    lines.push('');
    lines.push('Vui lòng kiểm tra và xác nhận/từ chối.');

    await sendMessage(config.telegram.ownerChatId, lines.join('\n'));

    // Update reminderSentAt for all sent results
    const ids = stillPending.map((r) => r.id);
    await prisma.ocrResult.updateMany({
      where: { id: { in: ids } },
      data: { reminderSentAt: new Date() },
    });

    logger.info('Reminders sent', {
      count: stillPending.length,
      skippedByUiSync: pendingResults.length - stillPending.length,
    });
    return stillPending.length;

  } catch (err) {
    logger.error('Error checking pending reminders', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Start the periodic reminder check (every 1 hour).
 */
export function startReminderScheduler(): void {
  if (reminderInterval) {
    logger.warn('Reminder scheduler already running');
    return;
  }

  // Check every 1 hour
  const intervalMs = 60 * 60 * 1000;
  reminderInterval = setInterval(() => {
    checkPendingReminders().catch((err) => {
      logger.error('Reminder check failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs);

  logger.info('⏰ Telegram reminder scheduler started (every 1h)');
}

/**
 * Stop the periodic reminder check.
 */
export function stopReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    logger.info('Telegram reminder scheduler stopped');
  }
}
