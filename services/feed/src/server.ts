
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { getRedis, disconnectRedis } from './config/redis';
import { startFanoutWorker, stopFanoutWorker } from './workers/feedFanout.worker';
import { startTrendingWorker, stopTrendingWorker } from './workers/trendingUpdater.worker';
import { disconnectKafka } from './utils/kafkaPublisher';
import { config } from './config';
import { logger } from './utils/logger';
import http from 'http';

let server: http.Server;

async function main(): Promise<void> {
    logger.info(`Starting ${config.serviceName}...`);
    await connectDB();
    getRedis();
    await startFanoutWorker();
    await startTrendingWorker();

    const app = createApp();
    server = http.createServer(app);
    server.listen(config.port, () => {
        logger.info({ port: config.port }, `✅ ${config.serviceName} running`);
    });
}

async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown started');
    server.close(async () => {
        await stopFanoutWorker();
        await stopTrendingWorker();
        await disconnectDB();
        await disconnectRedis();
        await disconnectKafka();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', err => { logger.fatal({ err }); process.exit(1); });
process.on('unhandledRejection', err => { logger.fatal({ err }); process.exit(1); });
main().catch(err => { logger.fatal({ err }, 'Startup failed'); process.exit(1); });
