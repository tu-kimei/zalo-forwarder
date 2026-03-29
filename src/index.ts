import { config } from './config';
import { createServer } from './server';
import { logger } from './lib/logger';
import { startPolling } from './modules/telegram/telegram.webhook';
import { startReminderScheduler } from './modules/telegram/telegram.reminder';
import { listenerService } from './modules/listener/listener.service';
import type { ZaloParsedMessage } from './modules/listener/message-parser';
import { PrismaClient } from '@prisma/client';
import { processMessage as runOcr } from './modules/ocr/ocr.service';
import { notifyOcrResult } from './modules/telegram/telegram.notifier';

const prisma = new PrismaClient();

// ─── Image Batching ───────────────────────────────────────────────────────────
// Group images sent within BATCH_WINDOW_MS into one OCR request
const BATCH_WINDOW_MS = 120_000; // 2 minutes

interface PendingBatch {
  groupId: string;
  groupName: string;
  senderId: string;
  category: string;
  messageIds: string[];
  images: string[];
  textMessages: string[];
  firstMsgTime: number;
  timer: ReturnType<typeof setTimeout>;
}

const pendingBatches = new Map<string, PendingBatch>();

function getBatchKey(groupId: string, senderId: string): string {
  return `${groupId}:${senderId}`;
}

async function processBatch(batch: PendingBatch): Promise<void> {
  const { groupId, groupName, senderId, category, messageIds, images, textMessages } = batch;
  const batchKey = getBatchKey(groupId, senderId);
  pendingBatches.delete(batchKey);

  logger.info('Processing image batch', {
    groupId,
    groupName,
    senderId,
    messageCount: messageIds.length,
    imageCount: images.length,
    textMessages: textMessages.length,
    category,
  });

  // Use the FIRST message as the anchor for OCR result
  const anchorMsgId = messageIds[0];
  const dbMsg = await prisma.zaloMessage.findUnique({ where: { id: anchorMsgId } });
  if (!dbMsg) {
    logger.warn('Anchor message not found for batch', { anchorMsgId });
    return;
  }

  // Update anchor message with ALL images + combined text from batch
  const combinedText = [dbMsg.text, ...textMessages].filter(Boolean).join('\n');
  await prisma.zaloMessage.update({
    where: { id: anchorMsgId },
    data: { 
      images,
      text: combinedText || null,
      groupName,
    },
  });

  try {
    const results = await runOcr(anchorMsgId, category);
    logger.info('Batch OCR done', { 
      anchorMsgId, 
      batchSize: messageIds.length,
      imageCount: images.length,
      results: results.length 
    });
    for (const r of results) {
      const ocrRecord = await prisma.ocrResult.findUnique({ where: { id: r.ocrResultId } });
      if (ocrRecord) await notifyOcrResult(ocrRecord);
    }
  } catch (err) {
    logger.error('Batch OCR error', {
      error: err instanceof Error ? err.message : String(err),
      anchorMsgId,
    });
  }
}

async function addToBatch(
  msg: ZaloParsedMessage,
  dbMsgId: string,
  category: string,
): Promise<void> {
  const batchKey = getBatchKey(msg.groupId!, msg.senderId);
  const now = Date.now();

  let batch = pendingBatches.get(batchKey);

  if (batch) {
    // Add to existing batch
    if (!batch.messageIds.includes(dbMsgId)) {
      batch.messageIds.push(dbMsgId);
    }
    if (msg.images.length > 0) {
      batch.images.push(...msg.images);
    }
    if (msg.text) {
      batch.textMessages.push(msg.text);
    }
    
    // Reset timer (extend window)
    clearTimeout(batch.timer);
    batch.timer = setTimeout(() => processBatch(batch!), BATCH_WINDOW_MS);
    
    logger.info('Added to existing batch', {
      batchKey,
      messageCount: batch.messageIds.length,
      totalImages: batch.images.length,
      textMessages: batch.textMessages.length,
    });
  } else {
    // Get group name from GroupConfig
    const groupConfig = await prisma.groupConfig.findUnique({
      where: { groupId: msg.groupId! },
      select: { groupName: true },
    });
    
    // Create new batch
    batch = {
      groupId: msg.groupId!,
      groupName: groupConfig?.groupName || msg.groupName || 'Unknown Group',
      senderId: msg.senderId,
      category,
      messageIds: [dbMsgId],
      images: [...msg.images],
      textMessages: msg.text ? [msg.text] : [],
      firstMsgTime: now,
      timer: setTimeout(() => processBatch(batch!), BATCH_WINDOW_MS),
    };
    pendingBatches.set(batchKey, batch);
    
    logger.info('Created new batch', {
      batchKey,
      imageCount: msg.images.length,
      hasText: !!msg.text,
      windowMs: BATCH_WINDOW_MS,
    });
  }
}

// ─── Auto-start all ACTIVE listeners ───────────────────────────────────────
async function autoStartListeners(): Promise<void> {
  try {
    const accounts = await prisma.zaloAccount.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, displayName: true },
    });

    if (accounts.length === 0) {
      logger.info('No ACTIVE accounts found for auto-start');
      return;
    }

    for (const account of accounts) {
      try {
        await listenerService.startListening(account.id);
        logger.info('✅ Auto-started listener', { accountId: account.id, displayName: account.displayName });
      } catch (err) {
        logger.error('❌ Failed to auto-start listener', {
          accountId: account.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info(`🔌 Auto-start complete: ${accounts.length} account(s) processed`);
  } catch (err) {
    logger.error('Auto-start listeners failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── WS Health Monitor (every 5 min) ──────────────────────────────────────
const WS_HEALTH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function sendTelegramAlert(text: string): Promise<void> {
  const botToken = config.telegram.botToken;
  const chatId = config.telegram.ownerChatId;
  if (!botToken || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch (err) {
    logger.error('Failed to send Telegram alert', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function wsHealthCheck(): Promise<void> {
  try {
    const accounts = await prisma.zaloAccount.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, displayName: true },
    });

    const results: string[] = [];
    let allOk = true;

    for (const account of accounts) {
      const isListening = listenerService.isListening(account.id);
      const status = isListening ? '🟢' : '🔴';
      results.push(`${status} ${account.displayName || account.id}`);

      if (!isListening) {
        allOk = false;
        try {
          await listenerService.startListening(account.id);
          results[results.length - 1] += ' 🔄 reconnected';
        } catch (err) {
          results[results.length - 1] += ' ❌ reconnect failed';
        }
      }
    }

    const alertPrefix = allOk ? '✅' : '⚠️';
    const alertText = `${alertPrefix} <b>Zalo Forwarder WS Check (5m)</b>\n\n${results.join('\n')}\n\n🕐 ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' })}`;
    await sendTelegramAlert(alertText);

    logger.info('WS health check done', { accounts: accounts.length, allOk, sentToTelegram: true });
  } catch (err) {
    logger.error('WS health check error', { error: err instanceof Error ? err.message : String(err) });
  }
}

function startWsHealthMonitor(): void {
  setInterval(wsHealthCheck, WS_HEALTH_INTERVAL_MS);
  logger.info(`🏥 WS health monitor started (every 5min)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const app = createServer();

  app.listen(config.port, () => {
    logger.info(`🚀 Zalo Forwarder running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });

    // Start Telegram bot long polling for button callbacks
    startPolling().catch((err) => {
      logger.error('Failed to start Telegram polling', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Start periodic reminder checks
    startReminderScheduler();

    // Auto-start all ACTIVE listeners
    autoStartListeners();

    // WS health monitor disabled per owner request (2026-03-29)
    // startWsHealthMonitor();

    listenerService.onMessage(async (msg: ZaloParsedMessage, accountId: string) => {
      try {
        if (!msg.groupId) return;

        const groupConfig = await prisma.groupConfig.findUnique({
          where: { groupId: msg.groupId },
        });

        if (!groupConfig || !groupConfig.active) {
          logger.debug('Message from non-monitored group or inactive group', {
            groupId: msg.groupId,
          });
          return;
        }

        // Only process IMAGE messages (skip VIDEO, STICKER, FILE, etc.)
        if (msg.type === 'IMAGE' && msg.images.length > 0) {
          logger.info('Image message received, adding to batch', {
            msgId: msg.msgId,
            groupId: msg.groupId,
            imageCount: msg.images.length,
            category: groupConfig.category,
          });

          // Wait for DB save
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          let dbMsg = await prisma.zaloMessage.findUnique({ where: { zaloMsgId: msg.msgId } });
          if (!dbMsg) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            dbMsg = await prisma.zaloMessage.findUnique({ where: { zaloMsgId: msg.msgId } });
          }
          
          if (!dbMsg) {
            logger.warn('Message not in DB yet, skipping batch', { msgId: msg.msgId });
            return;
          }

          // Add image to batch
          await addToBatch(msg, dbMsg.id, groupConfig.category ?? 'fuel');
          
        } else if (msg.type === 'TEXT' && msg.text) {
          // Check if there's an existing batch for this sender+group → add text to it
          const batchKey = getBatchKey(msg.groupId!, msg.senderId);
          const existingBatch = pendingBatches.get(batchKey);
          if (existingBatch) {
            existingBatch.textMessages.push(msg.text);
            clearTimeout(existingBatch.timer);
            existingBatch.timer = setTimeout(() => processBatch(existingBatch), BATCH_WINDOW_MS);
            logger.info('Text added to existing batch', { batchKey, text: msg.text.slice(0, 100) });
          } else {
            logger.debug('Text message from monitored group (no batch yet)', { 
              msgId: msg.msgId, 
              text: msg.text.slice(0, 100) 
            });
          }
        }
      } catch (err) {
        logger.error('Pipeline handler error', {
          error: err instanceof Error ? err.message : String(err),
          msgId: msg.msgId,
        });
      }
    });

    logger.info('✅ Zalo listener message handler registered');
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
