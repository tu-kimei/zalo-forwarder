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
} as const;
