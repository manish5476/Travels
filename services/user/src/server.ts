
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { getRedis, disconnectRedis } from './config/redis';
import { disconnectKafka } from './utils/kafkaPublisher';
import { startKafkaConsumers } from './worker/userEvent.consumer';
import { config } from './config';
import { logger } from './utils/logger';
import http from 'http';

let server: http.Server;

async function main(): Promise<void> {
    logger.info(`Starting ${config.serviceName}...`);
    await connectDB();
    getRedis();

    // Start Kafka consumer (listens for user.registered from Auth Service)
    await startKafkaConsumers();

    const app = createApp();
    server = http.createServer(app);
    server.listen(config.port, () => {
        logger.info({ port: config.port }, `✅ ${config.serviceName} running`);
    });
}

async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown started');
    server.close(async () => {
        await disconnectDB();
        await disconnectRedis();
        await disconnectKafka();
        logger.info('Shutdown complete');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', err => { logger.fatal({ err }, 'Uncaught'); process.exit(1); });
process.on('unhandledRejection', err => { logger.fatal({ err }, 'Unhandled rejection'); process.exit(1); });

main().catch(err => { logger.fatal({ err }, 'Startup failed'); process.exit(1); });
