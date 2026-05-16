
import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

export async function connectDB(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(config.mongo.uri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                heartbeatFrequencyMS: 10000,
                family: 4,   // Force IPv4
            });

            logger.info('✅ MongoDB connected');

            mongoose.connection.on('disconnected', () =>
                logger.warn('MongoDB disconnected'));
            mongoose.connection.on('reconnected', () =>
                logger.info('MongoDB reconnected'));
            mongoose.connection.on('error', (err) =>
                logger.error({ err }, 'MongoDB connection error'));

            return; // Success

        } catch (err) {
            const delay = BASE_DELAY_MS * attempt;
            logger.error({ err, attempt, nextRetryMs: delay },
                `MongoDB connection failed (${attempt}/${MAX_RETRIES})`);

            if (attempt === MAX_RETRIES) {
                logger.fatal('❌ MongoDB: all retries exhausted. Exiting.');
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
}




// import mongoose from 'mongoose';
// import { config } from './index';
// import { logger } from '../utils/logger';

// const MAX_RETRIES = 5;
// const RETRY_DELAY_MS = 3000;

// export async function connectDB(): Promise<void> {
//     for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
//         try {
//             await mongoose.connect(config.mongoUri, {
//                 maxPoolSize: 10,   // Max connections in pool
//                 serverSelectionTimeoutMS: 5000,
//                 socketTimeoutMS: 45000,
//                 family: 4,    // Use IPv4
//             });
//             logger.info('✅ MongoDB connected');

//             // Handle disconnection events
//             mongoose.connection.on('disconnected', () => {
//                 logger.warn('MongoDB disconnected. Attempting reconnect...');
//             });
//             mongoose.connection.on('error', (err) => {
//                 logger.error({ err }, 'MongoDB error');
//             });
//             return;
//         } catch (err) {
//             logger.error({ err, attempt }, `MongoDB connection failed (attempt ${attempt}/${MAX_RETRIES})`);
//             if (attempt === MAX_RETRIES) {
//                 logger.fatal('❌ MongoDB connection exhausted. Exiting.');
//                 process.exit(1);
//             }
//             await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
//         }
//     }
// }

// export async function disconnectDB(): Promise<void> {
//     await mongoose.connection.close();
//     logger.info('MongoDB disconnected gracefully');
// }
