import express from 'express';
import { logger } from './lib/logger';
import authRoutes from './modules/auth/auth.routes';
import webhookRoutes from './modules/webhook/webhook.routes';
import sessionRoutes from './modules/session/session.routes';
import groupRoutes from './modules/group/group.routes';
import telegramRoutes from './modules/telegram/telegram.routes';
import imageRoutes from './modules/images/image.routes';
import ocrRoutes from './modules/ocr/ocr.routes';
import openclawRoutes from './modules/openclaw/openclaw.routes';

export function createServer(): express.Application {
  const app = express();

  // ─── Middleware ────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.url}`);
    next();
  });

  // CORS (allow all in dev)
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // ─── Routes ────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/telegram', telegramRoutes);
  app.use('/api/images', imageRoutes);
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/openclaw', openclawRoutes);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error_code: 404,
      error_message: 'Not found',
    });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      error_code: 500,
      error_message: 'Internal server error',
    });
  });

  return app;
}
