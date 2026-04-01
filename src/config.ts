import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl: process.env.DATABASE_URL || 'postgresql://unicon_user:Unicon@2026@localhost:5432/zalo_forwarder',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET || 'dev-webhook-secret',

  zalo: {
    userAgent: process.env.ZALO_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    zpwVer: '627',
    zpwType: '30',
    clientVersion: 627,
    computerName: 'Web',
    qrVersion: '5.4.8',
  },

  healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '300000', 10),

  webhook: {
    retryMax: parseInt(process.env.WEBHOOK_RETRY_MAX || '3', 10),
    retryDelayMs: parseInt(process.env.WEBHOOK_RETRY_DELAY_MS || '1000', 10),
    timeoutMs: parseInt(process.env.WEBHOOK_TIMEOUT_MS || '10000', 10),
  },

  storage: {
    basePath: process.env.STORAGE_PATH || './storage/images',
    retentionDays: 90,
  },

  ocr: {
    aiBaseUrl: process.env.OCR_AI_BASE_URL || 'http://localhost:20128/v1',
    aiApiKey: process.env.OCR_AI_API_KEY || 'sk-332d09214d38df3a-hxnq07-676b2e7f',
    // Fallback list: try in order until one works
    aiModels: (process.env.OCR_AI_MODELS
      ? process.env.OCR_AI_MODELS.split(',').map((s) => s.trim()).filter(Boolean)
      : [
          'Free_For_OCR',
          'thinking-combo',
          'coding-combo',
          'cc/claude-sonnet-4-6',
          'cc/claude-haiku-4-5-20251001',
          'cc/claude-sonnet-4-5-20250929',
          'cx/gpt-5.4',
        ]) as string[],
  },

  uniconDb: {
    url: 'postgresql://unicon_user:Unicon@2026@localhost:5432/unicon_schedule',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '8727996392:AAG_dnX7Mrev2yPHDIKT6UUYF7dw2s_M2AQ',
    ownerChatId: process.env.TELEGRAM_OWNER_CHAT_ID || '6422203214',
    reminderIntervalHours: parseInt(process.env.TELEGRAM_REMINDER_HOURS || '12', 10),
  },

  openclaw: {
    inboundToken: process.env.OPENCLAW_INBOUND_TOKEN || '',
  },
} as const;
