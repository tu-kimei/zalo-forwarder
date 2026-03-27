import { config } from './config';
import { createServer } from './server';
import { logger } from './lib/logger';

async function main() {
  const app = createServer();

  app.listen(config.port, () => {
    logger.info(`🚀 Zalo Forwarder running on port ${config.port}`, {
      env: config.nodeEnv,
      port: config.port,
    });
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err });
  process.exit(1);
});
