import { Router } from 'express';
import {
  getStatus,
  sendTestMessage,
  handleWebhookUpdate,
  triggerReminder,
} from './telegram.controller';

const router = Router();

// GET /api/telegram/status — bot status & polling info
router.get('/status', getStatus);

// POST /api/telegram/test — send test message to owner
router.post('/test', sendTestMessage);

// POST /api/telegram/webhook — receive Telegram updates (webhook mode)
router.post('/webhook', handleWebhookUpdate);

// POST /api/telegram/remind — manually trigger reminder check
router.post('/remind', triggerReminder);

export default router;
