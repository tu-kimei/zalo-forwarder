import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { processMessage as runOcr } from '../ocr/ocr.service';
import { notifyOcrResult } from '../telegram/telegram.notifier';
import { upsertPendingUniconLogFromOcr } from '../unicon/unicon.service';
import { logger } from '../../lib/logger';
import { config } from '../../config';

const prisma = new PrismaClient();

interface OpenClawInboundBody {
  messageId?: string;
  msgId?: string;
  accountId?: string;
  groupId?: string;
  groupName?: string;
  senderId?: string;
  senderName?: string;
  text?: string | null;
  images?: string[];
  timestamp?: number;
  category?: 'fuel' | 'repair';
  raw?: unknown;
}

function getTokenFromRequest(req: Request): string | null {
  const xToken = req.header('x-openclaw-token');
  if (xToken && xToken.trim()) return xToken.trim();

  const auth = req.header('authorization');
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m?.[1]) return m[1].trim();
  }

  return null;
}

function generateFallbackMessageId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `openclaw-${Date.now()}-${rand}`;
}

function normalizeImages(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

async function resolveAccount(accountId?: string) {
  if (accountId) {
    const exact = await prisma.zaloAccount.findUnique({ where: { id: accountId } });
    if (exact) return exact;
  }

  const active = await prisma.zaloAccount.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
  });
  if (active) return active;

  return prisma.zaloAccount.findFirst({ orderBy: { updatedAt: 'desc' } });
}

/**
 * POST /api/openclaw/inbound
 * Ingest inbound message from OpenClaw/OpenZalo and run existing OCR pipeline.
 */
export async function ingestInbound(req: Request, res: Response): Promise<void> {
  try {
    const expectedToken = config.openclaw.inboundToken;
    if (expectedToken) {
      const incomingToken = getTokenFromRequest(req);
      if (!incomingToken || incomingToken !== expectedToken) {
        res.status(401).json({
          error_code: 401,
          error_message: 'Unauthorized: invalid openclaw inbound token',
        });
        return;
      }
    }

    const body = (req.body ?? {}) as OpenClawInboundBody;
    const groupId = String(body.groupId ?? '').trim();

    if (!groupId) {
      res.status(400).json({
        error_code: 400,
        error_message: 'groupId is required',
      });
      return;
    }

    const groupConfig = await prisma.groupConfig.findUnique({
      where: { groupId },
    });

    if (!groupConfig || !groupConfig.active) {
      res.status(202).json({
        error_code: 0,
        error_message: 'Ignored (group not configured or inactive)',
        data: {
          ignored: true,
          reason: 'group_not_configured_or_inactive',
          groupId,
        },
      });
      return;
    }

    const account = await resolveAccount(body.accountId);
    if (!account) {
      res.status(400).json({
        error_code: 400,
        error_message: 'No Zalo account found in DB. Login/create account first.',
      });
      return;
    }

    const images = normalizeImages(body.images);
    const text = typeof body.text === 'string' ? body.text : null;
    const messageType = images.length > 0 ? 'IMAGE' : 'TEXT';

    const incomingMsgId = String(body.messageId ?? body.msgId ?? generateFallbackMessageId());
    const timestamp = Number.isFinite(body.timestamp) ? Number(body.timestamp) : Date.now();

    const message = await prisma.zaloMessage.upsert({
      where: { zaloMsgId: incomingMsgId },
      update: {
        groupName: body.groupName ?? groupConfig.groupName ?? null,
        senderId: String(body.senderId ?? 'openclaw'),
        senderName: body.senderName ?? null,
        type: messageType,
        text,
        images,
        rawData: (body.raw ?? req.body) as object,
      },
      create: {
        zaloMsgId: incomingMsgId,
        accountId: account.id,
        groupId,
        groupName: body.groupName ?? groupConfig.groupName ?? null,
        senderId: String(body.senderId ?? 'openclaw'),
        senderName: body.senderName ?? null,
        type: messageType,
        text,
        images,
        rawData: {
          source: 'openclaw-api',
          timestamp,
          payload: body.raw ?? req.body,
        },
      },
    });

    await prisma.zaloAccount.update({
      where: { id: account.id },
      data: { lastMessageAt: new Date(timestamp) },
    });

    // Only run OCR when there are images
    if (images.length === 0) {
      res.json({
        error_code: 0,
        error_message: 'Accepted (text-only, OCR skipped)',
        data: {
          messageId: message.id,
          zaloMsgId: message.zaloMsgId,
          groupId,
          category: groupConfig.category,
          processed: false,
          reason: 'no_images',
        },
      });
      return;
    }

    const categoryFromGroup = groupConfig.category ?? null;
    const category = body.category ?? (categoryFromGroup === 'repair' ? 'repair' : 'fuel');

    const existingResultCount = await prisma.ocrResult.count({
      where: { messageId: message.id },
    });

    if (existingResultCount > 0) {
      res.json({
        error_code: 0,
        error_message: 'Already processed',
        data: {
          messageId: message.id,
          zaloMsgId: message.zaloMsgId,
          groupId,
          category,
          processed: false,
          reason: 'already_processed',
          existingResultCount,
        },
      });
      return;
    }

    const results = await runOcr(message.id, category);

    for (const r of results) {
      const ocrRecord = await prisma.ocrResult.findUnique({ where: { id: r.ocrResultId } });
      if (!ocrRecord) {
        continue;
      }

      // 1) Notify owner on Telegram
      await notifyOcrResult(ocrRecord);

      // 2) Immediately upsert pending record to unicon_schedule
      try {
        const unicon = await upsertPendingUniconLogFromOcr({
          ocr: ocrRecord,
          zaloMsgId: message.zaloMsgId,
          groupName: message.groupName,
          images,
        });

        await prisma.ocrResult.update({
          where: { id: ocrRecord.id },
          data:
            unicon.category === 'fuel'
              ? { writtenToDb: true, fuelLogId: unicon.logId }
              : { writtenToDb: true, repairLogId: unicon.logId },
        });
      } catch (err) {
        logger.error('Failed to upsert pending unicon log from OpenClaw inbound', {
          ocrResultId: ocrRecord.id,
          groupId,
          category,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('OpenClaw inbound message processed', {
      groupId,
      incomingMsgId,
      messageId: message.id,
      category,
      imageCount: images.length,
      resultCount: results.length,
    });

    res.json({
      error_code: 0,
      error_message: 'Processed',
      data: {
        messageId: message.id,
        zaloMsgId: message.zaloMsgId,
        groupId,
        category,
        processed: true,
        resultCount: results.length,
        results,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to ingest openclaw inbound message', { error: errMsg });
    res.status(500).json({
      error_code: 500,
      error_message: errMsg,
    });
  }
}

/**
 * GET /api/openclaw/inbound/health
 */
export async function inboundHealth(_req: Request, res: Response): Promise<void> {
  res.json({
    error_code: 0,
    error_message: 'OK',
    data: {
      service: 'openclaw-inbound',
      now: new Date().toISOString(),
      tokenRequired: Boolean(config.openclaw.inboundToken),
    },
  });
}
