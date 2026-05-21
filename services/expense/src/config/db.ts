import mongoose from 'mongoose';
import { config, logger } from './index';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

export async function connectDB(): Promise<void> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(config.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            logger.info('✅ MongoDB connected');

            mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
            mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
            mongoose.connection.on('error', err => logger.error({ err }, 'MongoDB error'));
            return;

        } catch (err) {
            const delay = BASE_DELAY_MS * attempt;
            logger.error({ err, attempt }, `MongoDB connect failed (${attempt}/${MAX_RETRIES})`);
            if (attempt === MAX_RETRIES) { logger.fatal('All retries exhausted'); process.exit(1); }
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

export async function disconnectDB(): Promise<void> {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected gracefully');
}
