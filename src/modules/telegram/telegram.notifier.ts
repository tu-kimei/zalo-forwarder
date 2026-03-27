import { PrismaClient, OcrResult } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import {
  sendMessage,
  sendPhoto,
  InlineKeyboardMarkup,
  SendMessageOptions,
} from './telegram.service';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a number with Vietnamese locale (dot separator): 1.000.000
 */
function formatVND(value: number | string | undefined | null): string {
  if (value == null || value === '') return '—';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[.,]/g, '')) : value;
  if (isNaN(num)) return String(value);
  return num.toLocaleString('vi-VN');
}

/**
 * Build confirm/reject inline keyboard for an OCR result.
 */
function buildReviewKeyboard(ocrResultId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirm', callback_data: `confirm:${ocrResultId}` },
        { text: '❌ Reject', callback_data: `reject:${ocrResultId}` },
      ],
    ],
  };
}

// ─── Data access helper ──────────────────────────────────────────────────────

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
  images?: string[];
  [key: string]: unknown;
}

function getData(ocr: OcrResult): ExtractedData {
  return (ocr.extractedData ?? {}) as ExtractedData;
}

// ─── Fuel Notification ───────────────────────────────────────────────────────

function formatFuelMessage(ocr: OcrResult): string {
  const d = getData(ocr);
  return [
    '⛽ Phiếu đổ dầu mới',
    '━━━━━━━━━━━━━━━',
    `🚛 Số xe: ${d.licensePlate ?? '—'}`,
    `👤 Tài xế: ${d.driverName ?? '—'}`,
    `📅 Ngày: ${d.date ?? '—'}`,
    `⛽ Số lít: ${d.liters != null ? `${formatVND(d.liters)}L` : '—'}`,
    `💰 Đơn giá: ${d.unitPrice != null ? `${formatVND(d.unitPrice)}đ/L` : '—'}`,
    `💵 Thành tiền: ${d.totalAmount != null ? `${formatVND(d.totalAmount)}đ` : '—'}`,
    `🏪 Cửa hàng: ${d.storeName ?? '—'}`,
    `📊 Confidence: ${ocr.confidence?.toFixed(2) ?? '—'}`,
  ].join('\n');
}

export async function notifyFuelResult(ocr: OcrResult): Promise<void> {
  const chatId = config.telegram.ownerChatId;
  const data = getData(ocr);
  const images = data.images ?? [];
  const text = formatFuelMessage(ocr);
  const keyboard = buildReviewKeyboard(ocr.id);

  let sentMsg;

  if (images.length > 0) {
    // Send first image as photo with caption
    sentMsg = await sendPhoto(chatId, images[0], text, {
      reply_markup: keyboard,
    });

    // Send remaining images as links
    if (images.length > 1) {
      const links = images.slice(1).map((url, i) => `📎 Ảnh ${i + 2}: ${url}`).join('\n');
      await sendMessage(chatId, links);
    }
  } else {
    sentMsg = await sendMessage(chatId, text, {
      reply_markup: keyboard,
    });
  }

  // Save telegram message ID for callback handling
  if (sentMsg) {
    await prisma.ocrResult.update({
      where: { id: ocr.id },
      data: { telegramMsgId: sentMsg.message_id },
    });
    logger.info('Fuel notification sent', { ocrResultId: ocr.id, telegramMsgId: sentMsg.message_id });
  } else {
    logger.error('Failed to send fuel notification', { ocrResultId: ocr.id });
  }
}

// ─── Repair Notification ─────────────────────────────────────────────────────

function formatRepairMessage(ocr: OcrResult): string {
  const d = getData(ocr);
  const lines = [
    '🔧 Phiếu sửa chữa mới',
    '━━━━━━━━━━━━━━━',
    `🚛 Số xe: ${d.licensePlate ?? '—'}`,
    `👤 Tài xế: ${d.driverName ?? '—'}`,
    `📅 Ngày: ${d.date ?? '—'}`,
    `🏭 Garage: ${d.garageName ?? '—'}`,
    `📍 Địa chỉ: ${d.address ?? '—'}`,
    `🔢 Số km: ${d.odometer != null ? formatVND(d.odometer) : '—'}`,
    '',
    '📋 Hạng mục:',
  ];

  const items = d.items ?? [];
  if (items.length > 0) {
    for (const item of items) {
      lines.push(`- ${item.name}: ${formatVND(item.amount)}đ`);
    }
  } else {
    lines.push('- (không có chi tiết)');
  }

  lines.push(`💵 Tổng: ${d.totalAmount != null ? `${formatVND(d.totalAmount)}đ` : '—'}`);
  lines.push(`📊 Confidence: ${ocr.confidence?.toFixed(2) ?? '—'}`);

  return lines.join('\n');
}

export async function notifyRepairResult(ocr: OcrResult): Promise<void> {
  const chatId = config.telegram.ownerChatId;
  const data = getData(ocr);
  const images = data.images ?? [];
  const text = formatRepairMessage(ocr);
  const keyboard = buildReviewKeyboard(ocr.id);

  let sentMsg;

  if (images.length > 0) {
    sentMsg = await sendPhoto(chatId, images[0], text, {
      reply_markup: keyboard,
    });

    if (images.length > 1) {
      const links = images.slice(1).map((url, i) => `📎 Ảnh ${i + 2}: ${url}`).join('\n');
      await sendMessage(chatId, links);
    }
  } else {
    sentMsg = await sendMessage(chatId, text, {
      reply_markup: keyboard,
    });
  }

  if (sentMsg) {
    await prisma.ocrResult.update({
      where: { id: ocr.id },
      data: { telegramMsgId: sentMsg.message_id },
    });
    logger.info('Repair notification sent', { ocrResultId: ocr.id, telegramMsgId: sentMsg.message_id });
  } else {
    logger.error('Failed to send repair notification', { ocrResultId: ocr.id });
  }
}

// ─── Unified Notifier ────────────────────────────────────────────────────────

/**
 * Send notification for an OCR result based on its category.
 * If the extractedData contains multiple invoices, sends each separately.
 */
export async function notifyOcrResult(ocr: OcrResult): Promise<void> {
  if (ocr.category === 'fuel') {
    await notifyFuelResult(ocr);
  } else if (ocr.category === 'repair') {
    await notifyRepairResult(ocr);
  } else {
    logger.warn('Unknown OCR category, sending generic notification', {
      ocrResultId: ocr.id,
      category: ocr.category,
    });
    const text = `📄 Kết quả OCR mới (${ocr.category})\nID: ${ocr.id}\nConfidence: ${ocr.confidence?.toFixed(2) ?? '—'}`;
    const keyboard = buildReviewKeyboard(ocr.id);
    const sentMsg = await sendMessage(config.telegram.ownerChatId, text, { reply_markup: keyboard });
    if (sentMsg) {
      await prisma.ocrResult.update({
        where: { id: ocr.id },
        data: { telegramMsgId: sentMsg.message_id },
      });
    }
  }
}
