
import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

// Main ioredis client — used for presence, typing, caching
// NOT used for Socket.io adapter (that uses node-redis client above)
let _redis: Redis | null = null;

export function getRedis(): Redis {
    if (_redis) return _redis;
    _redis = new Redis(config.redis.url, {
        db: config.redis.db,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
            if (times > 6) { logger.fatal('Redis exhausted'); process.exit(1); }
            return Math.min(times * 500, 3000);
        },
    });
    _redis.on('connect', () => logger.info('✅ Redis (ioredis) connected'));
    _redis.on('error', err => logger.error({ err }, 'Redis error'));
    return _redis;
}

export const redis = getRedis();

export async function disconnectRedis(): Promise<void> {
    if (_redis) { await _redis.quit(); _redis = null; }
}
