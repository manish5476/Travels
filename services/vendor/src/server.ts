import { createApp } from './app';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { connectKafka } from '@tripparty/shared';
import { config } from './config/index';
import { logger } from '@tripparty/shared';

async function main() {
  try {
    await connectDB(config.MONGO_URI);
    await connectRedis(config.REDIS_URL);
    await connectKafka(config.KAFKA_BROKERS, config.SERVICE_NAME);

    const app = createApp();
    const server = app.listen(parseInt(config.PORT), () => {
      logger.info(`Vendor Service running on port ${config.PORT}`);
    });

    // ── Graceful shutdown ────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down`);
      server.close(async () => {
        await require('./config/db').disconnectDB();
        await require('./config/redis').disconnectRedis();
        process.exit(0);
      });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error(err, 'Failed to start vendor service');
    process.exit(1);
  }
}

main();
