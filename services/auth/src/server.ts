import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { getRedis, disconnectRedis } from './config/redis';
import { disconnectKafka } from './utils/kafkaPublisher';
import { config } from './config';
import { logger } from './utils/logger';
import http from 'http';

let server: http.Server;

async function main(): Promise<void> {
    logger.info(`Starting ${config.serviceName}...`);

    await connectDB();    // MongoDB
    getRedis();           // Redis (logs connection status)

    const app = createApp();
    server = http.createServer(app);

    server.listen(config.port, () => {
        logger.info({ port: config.port, env: config.nodeEnv },
            `✅ ${config.serviceName} running`);
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
            logger.fatal({ port: config.port }, 'Port already in use');
        } else {
            logger.fatal({ err }, 'Server error');
        }
        process.exit(1);
    });
}

// ── GRACEFUL SHUTDOWN ─────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Shutdown started...');

    server.close(async () => {
        logger.info('HTTP server closed (no new connections)');
        await disconnectDB();
        await disconnectRedis();
        await disconnectKafka();
        logger.info('All connections closed. Exit.');
        process.exit(0);
    });

    // Force kill after 10 seconds
    setTimeout(() => {
        logger.fatal('Graceful shutdown timed out. Force exiting.');
        process.exit(1);
    }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));  // K8s sends this
process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in dev

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    process.exit(1);
});

main().catch(err => {
    logger.fatal({ err }, 'Failed to start');
    process.exit(1);
});





// import { createApp } from './app';
// import { connectDB, disconnectDB } from './config/db';
// import { getRedis } from './config/redis';
// import { disconnectKafka } from './utils/kafka-publisher';
// import { config } from './config';
// import { logger } from './utils/logger';
// import http from 'http';

// let server: http.Server;

// async function main() {
//     logger.info('Starting Auth Service...');

//     // ── CONNECT DEPENDENCIES ──────────────────────────────────
//     await connectDB();
//     getRedis(); // Initialize singleton (logs connection)

//     // ── START HTTP SERVER ─────────────────────────────────────
//     const app = createApp();
//     server = http.createServer(app);

//     server.listen(config.port, () => {
//         logger.info({ port: config.port, env: config.nodeEnv }, '✅ Auth Service is running');
//     });

//     server.on('error', (err) => {
//         logger.fatal({ err }, 'Server error');
//         process.exit(1);
//     });
// }

// // ── GRACEFUL SHUTDOWN ─────────────────────────────────────
// async function shutdown(signal: string) {
//     logger.info({ signal }, 'Shutdown signal received. Closing gracefully...');

//     server.close(async () => {
//         logger.info('HTTP server closed');
//         await disconnectDB();
//         await disconnectKafka();
//         logger.info('All connections closed. Goodbye.');
//         process.exit(0);
//     });

//     // Force close after 10 seconds if graceful shutdown takes too long
//     setTimeout(() => {
//         logger.fatal('Forced shutdown after timeout');
//         process.exit(1);
//     }, 10_000);
// }

// process.on('SIGTERM', () => shutdown('SIGTERM'));  // Kubernetes sends this
// process.on('SIGINT', () => shutdown('SIGINT'));   // Ctrl+C in dev

// process.on('uncaughtException', (err) => {
//     logger.fatal({ err }, '❌ Uncaught exception');
//     process.exit(1);
// });

// process.on('unhandledRejection', (reason) => {
//     logger.fatal({ reason }, '❌ Unhandled promise rejection');
//     process.exit(1);
// });

// main().catch((err) => {
//     logger.fatal({ err }, '❌ Failed to start');
//     process.exit(1);
// });

