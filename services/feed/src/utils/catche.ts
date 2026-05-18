
import { redis } from '../config/redis';
import { logger } from './logger';

export const cache = {
    async get<T>(key: string): Promise<T | null> {
        try {
            const raw = await redis.get(key);
            return raw ? JSON.parse(raw) as T : null;
        } catch { return null; }
    },

    async set(key: string, value: unknown, ttl: number): Promise<void> {
        try { await redis.setex(key, ttl, JSON.stringify(value)); }
        catch (err) { logger.warn({ err, key }, 'Cache set failed'); }
    },

    async del(key: string): Promise<void> {
        try { await redis.del(key); }
        catch (err) { logger.warn({ err, key }, 'Cache del failed'); }
    },

    async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) return cached;
        const data = await fetcher();
        if (data !== null && data !== undefined) await this.set(key, data, ttl);
        return data;
    },
};
