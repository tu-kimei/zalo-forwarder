import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import {
  getUpdates,
  answerCallbackQuery,
  editMessageReplyMarkup,
  editMessageText,
  editMessageCaption,
  deleteWebhook,
  TelegramUpdate,
  TelegramCallbackQuery,
} from './telegram.service';

const prisma = new PrismaClient();

// Prisma client for unicon_schedule database (write confirmed data)
const uniconPrisma = new PrismaClient({
  datasources: { db: { url: config.uniconDb.url } },
});

let pollingActive = false;
let pollOffset: number | undefined;

// ─── Callback Handler ────────────────────────────────────────────────────────

async function handleCallbackQuery(cbq: TelegramCallbackQuery): Promise<void> {
  const data = cbq.data;
  if (!data) return;

  const [action, ocrResultId] = data.split(':');
  
  // Handle test buttons
  if (action === 'test') {
    await answerCallbackQuery(cbq.id, `✅ Test ${ocrResultId} thành công!`);
    return;
  }

  if (!ocrResultId || (action !== 'confirm' && action !== 'reject')) {
    await answerCallbackQuery(cbq.id, '⚠️ Lệnh không hợp lệ');
    return;
  }

  // Find the OCR result
  const ocr = await prisma.ocrResult.findUnique({
    where: { id: ocrResultId },
    include: { message: true },
  });

  if (!ocr) {
    await answerCallbackQuery(cbq.id, '⚠️ Không tìm thấy kết quả OCR');
    return;
  }

  if (ocr.status !== 'pending') {
    await answerCallbackQuery(cbq.id, `ℹ️ Đã xử lý rồi (${ocr.status})`);
    return;
  }

  const chatId = config.telegram.ownerChatId;
  const messageId = cbq.message?.message_id;

  if (action === 'confirm') {
    // 1. Update status
    await prisma.ocrResult.update({
      where: { id: ocrResultId },
      data: {
        status: 'confirmed',
        reviewedAt: new Date(),
      },
    });

    // 2. Write to unicon_schedule database
    await writeToUniconDb(ocr);

    // 3. Update telegram message
    if (messageId) {
      // Remove buttons
      await editMessageReplyMarkup(chatId, messageId);
      // Try to append confirmation to caption (photo) or text
      try {
        await editMessageCaption(chatId, messageId, '');
      } catch {
        // If not a photo message, this will fail silently
      }
    }

    await answerCallbackQuery(cbq.id, '✅ Đã xác nhận');
    logger.info('OCR result confirmed', { ocrResultId, category: ocr.category });

  } else if (action === 'reject') {
    // 1. Update status
    await prisma.ocrResult.update({
      where: { id: ocrResultId },
      data: {
        status: 'rejected',
        reviewedAt: new Date(),
      },
    });

    // 2. Update telegram message
    if (messageId) {
      await editMessageReplyMarkup(chatId, messageId);
    }

    await answerCallbackQuery(cbq.id, '❌ Đã từ chối');
    logger.info('OCR result rejected', { ocrResultId, category: ocr.category });
  }
}

// ─── Write to unicon_schedule ────────────────────────────────────────────────

interface ExtractedData {
  licensePlate?: string;
  driverName?: string;
  date?: string;
  liters?: number | string;
  unitPrice?: number | string;
  totalAmount?: number | string;
  storeName?: string;
  garageName?: string;
  address?: string;
  odometer?: number | string;
  items?: Array<{ name: string; amount: number | string }>;
  [key: string]: unknown;
}

async function writeToUniconDb(
  ocr: { id: string; category: string; extractedData: unknown; confidence: number },
): Promise<void> {
  const data = (ocr.extractedData ?? {}) as ExtractedData;

  try {
    if (ocr.category === 'fuel') {
      // Insert into fuel_logs table in unicon_schedule
      await uniconPrisma.$executeRawUnsafe(
        `INSERT INTO fuel_logs (license_plate, driver_name, fuel_date, liters, unit_price, total_amount, store_name, source, confidence, ocr_result_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'zalo_ocr', $8, $9, NOW())`,
        data.licensePlate ?? null,
        data.driverName ?? null,
        data.date ?? null,
        data.liters != null ? Number(data.liters) : null,
        data.unitPrice != null ? Number(data.unitPrice) : null,
        data.totalAmount != null ? Number(data.totalAmount) : null,
        data.storeName ?? null,
        ocr.confidence,
        ocr.id,
      );

      await prisma.ocrResult.update({
        where: { id: ocr.id },
        data: { writtenToDb: true },
      });

      logger.info('Fuel log written to unicon_schedule', { ocrResultId: ocr.id });

    } else if (ocr.category === 'repair') {
      // Insert into repair_logs table in unicon_schedule
      await uniconPrisma.$executeRawUnsafe(
        `INSERT INTO repair_logs (license_plate, driver_name, repair_date, garage_name, address, odometer, items, total_amount, source, confidence, ocr_result_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'zalo_ocr', $9, $10, NOW())`,
        data.licensePlate ?? null,
        data.driverName ?? null,
        data.date ?? null,
        data.garageName ?? null,
        data.address ?? null,
        data.odometer != null ? Number(data.odometer) : null,
        JSON.stringify(data.items ?? []),
        data.totalAmount != null ? Number(data.totalAmount) : null,
        ocr.confidence,
        ocr.id,
      );

      await prisma.ocrResult.update({
        where: { id: ocr.id },
        data: { writtenToDb: true },
      });

      logger.info('Repair log written to unicon_schedule', { ocrResultId: ocr.id });
    }
  } catch (err) {
    logger.error('Failed to write to unicon_schedule', {
      ocrResultId: ocr.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't throw — the confirmation still succeeded, just the DB write failed
    // This can be retried later
  }
}

// ─── Long Polling ────────────────────────────────────────────────────────────

async function pollLoop(): Promise<void> {
  while (pollingActive) {
    try {
      const updates = await getUpdates(pollOffset, 30);

      for (const update of updates) {
        pollOffset = update.update_id + 1;

        if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    } catch (err) {
      logger.error('Telegram polling error', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Start long polling for Telegram updates.
 */
export async function startPolling(): Promise<void> {
  if (pollingActive) {
    logger.warn('Telegram polling already active');
    return;
  }

  // Delete any existing webhook so getUpdates works
  await deleteWebhook();

  pollingActive = true;
  logger.info('🤖 Telegram long polling started');

  // Run in background (don't await)
  pollLoop().catch((err) => {
    logger.error('Telegram poll loop crashed', {
      error: err instanceof Error ? err.message : String(err),
    });
    pollingActive = false;
  });
}

/**
 * Stop long polling.
 */
export function stopPolling(): void {
  pollingActive = false;
  logger.info('Telegram long polling stopped');
}

/**
 * Check if polling is active.
 */
export function isPollingActive(): boolean {
  return pollingActive;
}
