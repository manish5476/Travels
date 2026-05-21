import 'express-async-errors';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { connectRedis, disconnectRedis } from './config/redis';
import { connectKafka, disconnectKafka } from './kafka/producer';
import { startExpenseWorker } from './workers/expense.worker';
import { config, logger } from './config/index';

async function main(): Promise<void> {
    try {
        // ── Connect all infrastructure in order ─────────────────────────
        await connectDB();
        await connectRedis();
        await connectKafka(config.KAFKA_BROKERS, config.SERVICE_NAME);

        // ── Start Kafka worker (consumes trip.state_changed) ──────────
        await startExpenseWorker();

        const app = createApp();
        const server = app.listen(parseInt(config.PORT), () => {
            logger.info(`✅ Expense Service running on port ${config.PORT}`);
        });

        // ── Graceful shutdown ──────────────────────────────────────────
        const shutdown = async (signal: string): Promise<void> => {
            logger.info({ signal }, 'Shutdown signal received');
            server.close(async () => {
                await disconnectKafka();
                await disconnectDB();
                await disconnectRedis();
                logger.info('Expense Service shut down cleanly');
                process.exit(0);
            });
            // Force kill if graceful shutdown takes too long
            setTimeout(() => { logger.fatal('Forced shutdown'); process.exit(1); }, 15000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (err) {
        logger.fatal({ err }, '❌ Failed to start Expense Service');
        process.exit(1);
    }
}

main();
