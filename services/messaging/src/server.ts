
import http from 'http';
import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { getRedis, disconnectRedis } from './config/redis';
import { createSocketServer } from './config/socket';
import { setupPresenceHandlers } from './sockets/presence.socket';
import { registerChatHandlers } from './sockets/chat.socket';
import {
    startMessageDeliveryWorker,
    stopMessageDeliveryWorker
} from './workers/messageDelivery.worker';
import { disconnectKafka } from './utils/kafkaPublisher';
import { config } from './config';
import { logger } from './utils/logger';

let server: http.Server;

async function main(): Promise<void> {
    logger.info(`Starting ${config.serviceName}...`);

    await connectDB();
    getRedis();

    const app = createApp();
    server = http.createServer(app);

    // ── SOCKET.IO SETUP ───────────────────────────────────
    const io = await createSocketServer(server);

    // 1. Register auth middleware (runs before all socket events)
    setupPresenceHandlers(io);

    // 2. Register chat event handlers for each new connection
    io.on('connection', (socket) => {
        registerChatHandlers(io, socket);
    });

    // ── KAFKA WORKERS ─────────────────────────────────────
    await startMessageDeliveryWorker();

    // ── START HTTP SERVER ─────────────────────────────────
    server.listen(config.port, () => {
        logger.info({ port: config.port }, `✅ ${config.serviceName} running`);
        logger.info('Socket.io WebSocket server ready');
    });
}

async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown started');
    server.close(async () => {
        await stopMessageDeliveryWorker();
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
process.on('uncaughtException', err => { logger.fatal({ err }); process.exit(1); });
process.on('unhandledRejection', err => { logger.fatal({ err }); process.exit(1); });
main().catch(err => { logger.fatal({ err }, 'Startup failed'); process.exit(1); });
