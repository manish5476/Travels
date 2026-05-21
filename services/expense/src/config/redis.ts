import Redis from 'ioredis';
import { config, logger } from './index';

let _redis: Redis | null = null;

export function getRedis(): Redis {
    if (_redis) return _redis;

    _redis = new Redis(config.REDIS_URL, {
        lazyConnect: true,
        retryStrategy: times => Math.min(times * 200, 5000),
        reconnectOnError: err => err.message.includes('READONLY'),
    });

    _redis.on('connect', () => logger.info('✅ Redis connected'));
    _redis.on('error', err => logger.error({ err }, 'Redis error'));
    _redis.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    return _redis;
}

export async function connectRedis(): Promise<void> {
    await getRedis().connect();
}

export async function disconnectRedis(): Promise<void> {
    if (_redis) { await _redis.quit(); _redis = null; }
}
