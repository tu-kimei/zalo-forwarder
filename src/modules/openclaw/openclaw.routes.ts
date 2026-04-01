import { Router } from 'express';
import { ingestInbound, inboundHealth } from './openclaw.controller';

const router = Router();

// Health endpoint
router.get('/inbound/health', inboundHealth);

// Main ingest endpoint for OpenClaw/OpenZalo inbound events
router.post('/inbound', ingestInbound);

export default router;
