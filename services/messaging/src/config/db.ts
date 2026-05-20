
import mongoose from 'mongoose';
import { config } from './index';
import { logger } from '../utils/logger';

export async function connectDB(): Promise<void> {
    const MAX = 5;
    for (let i = 1; i <= MAX; i++) {
        try {
            await mongoose.connect(config.mongo.uri, {
                maxPoolSize: 20,  // Higher pool — many concurrent socket connections
                serverSelectionTimeoutMS: 5000, family: 4,
            });
            logger.info('✅ MongoDB connected');
            mongoose.connection.on('error', err => logger.error({ err }, 'MongoDB error'));
            return;
        } catch (err) {
            logger.error({ err, attempt: i }, 'MongoDB connect failed');
            if (i === MAX) { logger.fatal('MongoDB exhausted'); process.exit(1); }
            await new Promise(r => setTimeout(r, 2000 * i));
        }
    }
}
export async function disconnectDB(): Promise<void> {
    await mongoose.connection.close();
}
