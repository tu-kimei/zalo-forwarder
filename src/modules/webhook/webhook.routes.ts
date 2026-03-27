import { Router } from 'express';
import * as controller from './webhook.controller';

const router = Router();

// GET  /           — List all webhooks
// POST /           — Create a webhook
router.get('/', controller.listWebhooks);
router.post('/', controller.createWebhook);

// POST /retry      — Retry all failed deliveries
router.post('/retry', controller.retryFailed);

// PUT    /:id      — Update a webhook
// DELETE /:id      — Delete a webhook
router.put('/:id', controller.updateWebhook);
router.delete('/:id', controller.deleteWebhook);

// POST /:id/test   — Send a test webhook
router.post('/:id/test', controller.testWebhook);

// GET  /:id/logs   — Get delivery logs for a webhook
router.get('/:id/logs', controller.getWebhookLogs);

export default router;
