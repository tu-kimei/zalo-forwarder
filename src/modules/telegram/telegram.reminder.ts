import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { sendMessage, InlineKeyboardMarkup } from './telegram.service';

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

    // Group by category for a summary message
    const fuelCount = pendingResults.filter((r) => r.category === 'fuel').length;
    const repairCount = pendingResults.filter((r) => r.category === 'repair').length;

    const lines = [
      '⏰ Nhắc nhở: Có kết quả OCR chưa xử lý',
      '━━━━━━━━━━━━━━━',
      `📊 Tổng: ${pendingResults.length} phiếu chờ duyệt`,
    ];

    if (fuelCount > 0) lines.push(`  ⛽ Đổ dầu: ${fuelCount}`);
    if (repairCount > 0) lines.push(`  🔧 Sửa chữa: ${repairCount}`);

    lines.push('');

    // List individual items (up to 10)
    const shown = pendingResults.slice(0, 10);
    for (const ocr of shown) {
      const data = (ocr.extractedData ?? {}) as Record<string, unknown>;
      const plate = (data.licensePlate as string) ?? '—';
      const icon = ocr.category === 'fuel' ? '⛽' : '🔧';
      const age = Math.round((Date.now() - ocr.createdAt.getTime()) / 3600000);
      lines.push(`${icon} ${plate} — ${age}h trước`);
    }

    if (pendingResults.length > 10) {
      lines.push(`... và ${pendingResults.length - 10} phiếu khác`);
    }

    lines.push('');
    lines.push('Vui lòng kiểm tra và xác nhận/từ chối.');

    await sendMessage(config.telegram.ownerChatId, lines.join('\n'));

    // Update reminderSentAt for all sent results
    const ids = pendingResults.map((r) => r.id);
    await prisma.ocrResult.updateMany({
      where: { id: { in: ids } },
      data: { reminderSentAt: new Date() },
    });

    logger.info('Reminders sent', { count: pendingResults.length });
    return pendingResults.length;

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
