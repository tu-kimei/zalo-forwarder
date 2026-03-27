import { PrismaClient } from '@prisma/client';
import { sendWebhookRequest, SendResult } from './webhook.sender';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getAllWebhooks() {
  return prisma.webhookConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function getWebhookById(id: string) {
  return prisma.webhookConfig.findUnique({ where: { id } });
}

export async function createWebhook(data: {
  name: string;
  url: string;
  secret?: string;
  events?: string[];
  groupFilter?: string[];
  active?: boolean;
}) {
  return prisma.webhookConfig.create({
    data: {
      name: data.name,
      url: data.url,
      secret: data.secret ?? null,
      events: data.events ?? ['message'],
      groupFilter: data.groupFilter ?? [],
      active: data.active ?? true,
    },
  });
}

export async function updateWebhook(
  id: string,
  data: {
    name?: string;
    url?: string;
    secret?: string;
    events?: string[];
    groupFilter?: string[];
    active?: boolean;
  },
) {
  return prisma.webhookConfig.update({
    where: { id },
    data,
  });
}

export async function deleteWebhook(id: string) {
  // Delete related logs first
  await prisma.webhookLog.deleteMany({ where: { webhookId: id } });
  return prisma.webhookConfig.delete({ where: { id } });
}

// ─── Webhook Delivery ────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: string;
  source: string;
  account_id: string;
  group: { id: string; name: string };
  sender: { id: string; name: string };
  message: {
    id: string;
    type: string;
    text: string | null;
    images: string[];
    timestamp: number;
  };
  raw: unknown;
}

/**
 * Send a webhook payload to a single webhook config and log the result.
 */
export async function sendWebhook(
  webhookConfig: { id: string; url: string; secret: string | null },
  payload: WebhookPayload,
  messageId?: string,
  accountId?: string,
): Promise<SendResult> {
  const result = await sendWebhookRequest(webhookConfig.url, payload, webhookConfig.secret);

  // Log delivery
  await prisma.webhookLog.create({
    data: {
      webhookId: webhookConfig.id,
      messageId: messageId ?? null,
      accountId: accountId ?? null,
      payload: payload as object,
      statusCode: result.statusCode ?? null,
      response: result.response ?? null,
      attempt: result.attempt,
      success: result.success,
      error: result.error ?? null,
    },
  });

  return result;
}

/**
 * Broadcast a payload to all active webhooks matching the event and group.
 */
export async function broadcastWebhook(
  payload: WebhookPayload,
  messageId?: string,
  accountId?: string,
): Promise<SendResult[]> {
  const webhooks = await prisma.webhookConfig.findMany({
    where: { active: true },
  });

  const results: SendResult[] = [];

  for (const wh of webhooks) {
    // Check event filter
    if (wh.events.length > 0 && !wh.events.includes(payload.event)) {
      continue;
    }

    // Check group filter (empty = all groups)
    if (wh.groupFilter.length > 0 && !wh.groupFilter.includes(payload.group.id)) {
      continue;
    }

    const result = await sendWebhook(wh, payload, messageId, accountId);
    results.push({ ...result, webhookId: wh.id } as SendResult & { webhookId: string });
  }

  return results;
}

/**
 * Retry all failed webhook deliveries (success = false).
 */
export async function retryFailedWebhooks(): Promise<{ retried: number; succeeded: number }> {
  const failedLogs = await prisma.webhookLog.findMany({
    where: { success: false },
    include: { webhook: true },
    orderBy: { createdAt: 'asc' },
    take: 100, // Process in batches
  });

  let retried = 0;
  let succeeded = 0;

  for (const log of failedLogs) {
    if (!log.webhook.active) continue;

    retried++;
    const result = await sendWebhookRequest(
      log.webhook.url,
      log.payload,
      log.webhook.secret,
    );

    // Update the existing log entry
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        statusCode: result.statusCode ?? null,
        response: result.response ?? null,
        attempt: log.attempt + 1,
        success: result.success,
        error: result.error ?? null,
      },
    });

    if (result.success) succeeded++;
  }

  logger.info('Retried failed webhooks', { retried, succeeded });
  return { retried, succeeded };
}

/**
 * Get webhook logs for a specific webhook.
 */
export async function getWebhookLogs(webhookId: string, limit = 50) {
  return prisma.webhookLog.findMany({
    where: { webhookId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
