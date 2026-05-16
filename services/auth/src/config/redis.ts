
import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let _redis: Redis | null = null;

export function getRedis(): Redis {
    if (_redis) return _redis;

    _redis = new Redis(config.redis.url, {
        db: config.redis.db,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,

        retryStrategy(times: number) {
            if (times > 6) {
                logger.fatal('❌ Redis: all retries exhausted. Exiting.');
                process.exit(1);
            }
            const delay = Math.min(times * 500, 3000);
            logger.warn({ times, delay }, 'Redis retry');
            return delay;
        },

        reconnectOnError(err: Error) {
            const reconnectOn = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
            return reconnectOn.some(e => err.message.includes(e));
        },
    });

    _redis.on('connect', () => logger.info('✅ Redis connected'));
    _redis.on('ready', () => logger.info('Redis ready'));
    _redis.on('error', (err) => logger.error({ err }, 'Redis error'));
    _redis.on('close', () => logger.warn('Redis connection closed'));
    _redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    return _redis;
}

// Export singleton — import this everywhere
export const redis = getRedis();

export async function disconnectRedis(): Promise<void> {
    if (_redis) {
        await _redis.quit();
        _redis = null;
        logger.info('Redis disconnected gracefully');
    }
}


// import Redis from 'ioredis';
// import { config } from './index';
// import { logger } from '../utils/logger';

// let redisClient: Redis;

// export function getRedis(): Redis {
//     if (redisClient) return redisClient;

//     redisClient = new Redis(config.redisUrl, {
//         db: config.redisDb,
//         maxRetriesPerRequest: 3,
//         retryStrategy(times) {
//             if (times > 5) {
//                 logger.fatal('❌ Redis connection exhausted. Exiting.');
//                 process.exit(1);
//             }
//             return Math.min(times * 500, 3000); // Exponential backoff
//         },
//         reconnectOnError(err) {
//             const targetErrors = ['READONLY', 'ECONNRESET'];
//             return targetErrors.some(e => err.message.includes(e));
//         },
//     });

//     redisClient.on('connect', () => logger.info('✅ Redis connected'));
//     redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
//     redisClient.on('reconnecting', () => logger.warn('Redis reconnecting...'));

//     return redisClient;
// }

// // Convenience export — most files just import this
// export const redis = getRedis();
