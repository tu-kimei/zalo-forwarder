import { config } from './config';
import { createServer } from './server';
import { logger } from './lib/logger';
import { startPolling } from './modules/telegram/telegram.webhook';
import { startReminderScheduler } from './modules/telegram/telegram.reminder';

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

    // Start periodic reminder checks (every 1h)
    startReminderScheduler();
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
