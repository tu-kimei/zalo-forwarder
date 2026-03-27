import { Request, Response } from 'express';
import * as webhookService from './webhook.service';
import { logger } from '../../lib/logger';

export async function listWebhooks(_req: Request, res: Response): Promise<void> {
  try {
    const webhooks = await webhookService.getAllWebhooks();
    res.json({ error_code: 0, error_message: 'OK', data: webhooks });
  } catch (err) {
    logger.error('Failed to list webhooks', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function createWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { name, url, secret, events, groupFilter, active } = req.body;

    if (!name || !url) {
      res.status(400).json({ error_code: 400, error_message: 'name and url are required' });
      return;
    }

    const webhook = await webhookService.createWebhook({ name, url, secret, events, groupFilter, active });
    res.status(201).json({ error_code: 0, error_message: 'Created', data: webhook });
  } catch (err) {
    logger.error('Failed to create webhook', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function updateWebhook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await webhookService.getWebhookById(id);

    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'Webhook not found' });
      return;
    }

    const { name, url, secret, events, groupFilter, active } = req.body;
    const webhook = await webhookService.updateWebhook(id, { name, url, secret, events, groupFilter, active });
    res.json({ error_code: 0, error_message: 'Updated', data: webhook });
  } catch (err) {
    logger.error('Failed to update webhook', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await webhookService.getWebhookById(id);

    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'Webhook not found' });
      return;
    }

    await webhookService.deleteWebhook(id);
    res.json({ error_code: 0, error_message: 'Deleted' });
  } catch (err) {
    logger.error('Failed to delete webhook', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function retryFailed(_req: Request, res: Response): Promise<void> {
  try {
    const result = await webhookService.retryFailedWebhooks();
    res.json({ error_code: 0, error_message: 'OK', data: result });
  } catch (err) {
    logger.error('Failed to retry webhooks', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function testWebhook(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const webhook = await webhookService.getWebhookById(id);

    if (!webhook) {
      res.status(404).json({ error_code: 404, error_message: 'Webhook not found' });
      return;
    }

    const testPayload: webhookService.WebhookPayload = {
      event: 'test',
      source: 'zalo',
      account_id: 'test-account',
      group: { id: 'test-group', name: 'Test Group' },
      sender: { id: 'test-sender', name: 'Test User' },
      message: {
        id: 'test-message',
        type: 'text',
        text: 'This is a test webhook delivery.',
        images: [],
        timestamp: Date.now(),
      },
      raw: {},
    };

    const result = await webhookService.sendWebhook(webhook, testPayload);
    res.json({ error_code: 0, error_message: 'Test sent', data: result });
  } catch (err) {
    logger.error('Failed to test webhook', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function getWebhookLogs(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const webhook = await webhookService.getWebhookById(id);

    if (!webhook) {
      res.status(404).json({ error_code: 404, error_message: 'Webhook not found' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await webhookService.getWebhookLogs(id, limit);
    res.json({ error_code: 0, error_message: 'OK', data: logs });
  } catch (err) {
    logger.error('Failed to get webhook logs', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}
