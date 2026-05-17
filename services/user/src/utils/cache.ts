import { redis } from '../config/redis';
import { logger } from './logger';

export const cache = {

    // ── GET ─────────────────────────────────────────────────
    async get<T>(key: string): Promise<T | null> {
        try {
            const raw = await redis.get(key);
            if (!raw) return null;
            return JSON.parse(raw) as T;
        } catch (err) {
            logger.warn({ err, key }, 'Cache GET failed — cache miss');
            return null;  // Always degrade gracefully to DB
        }
    },

    // ── SET ─────────────────────────────────────────────────
    async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
        try {
            await redis.setex(key, ttlSeconds, JSON.stringify(value));
        } catch (err) {
            logger.warn({ err, key }, 'Cache SET failed — non-fatal');
        }
    },

    // ── DELETE ──────────────────────────────────────────────
    async del(key: string): Promise<void> {
        try {
            await redis.del(key);
        } catch (err) {
            logger.warn({ err, key }, 'Cache DEL failed — non-fatal');
        }
    },

    // ── DELETE BY PATTERN ───────────────────────────────────
    // Use sparingly — SCAN is O(N). Only for invalidation on update.
    async delPattern(pattern: string): Promise<void> {
        try {
            let cursor = '0';
            do {
                const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
                cursor = next;
                if (keys.length > 0) {
                    await redis.del(...keys);
                }
            } while (cursor !== '0');
        } catch (err) {
            logger.warn({ err, pattern }, 'Cache delPattern failed — non-fatal');
        }
    },

    // ── GET OR FETCH ─────────────────────────────────────────
    // Cache-aside pattern: check cache first, fetch from DB if miss
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl: number
    ): Promise<T> {
        const cached = await this.get<T>(key);
        if (cached !== null) return cached;

        const data = await fetcher();
        if (data !== null && data !== undefined) {
            await this.set(key, data, ttl);
        }
        return data;
    },

    // ── ATOMIC INCREMENT ─────────────────────────────────────
    // For denormalized counters (follower_count etc.)
    async incr(key: string, by = 1): Promise<number> {
        return redis.incrby(key, by);
    },

    async decr(key: string, by = 1): Promise<number> {
        const val = await redis.decrby(key, by);
        return Math.max(0, val);  // Never go below 0
    },

    // ── KEY FACTORIES ────────────────────────────────────────
    // Central place for all cache key names — never hardcode strings
    keys: {
        profile: (userId: string) => `user:profile:${userId}`,
        profileByName: (username: string) => `user:profile:name:${username}`,
        followerCount: (userId: string) => `user:followers:count:${userId}`,
        followingCount: (userId: string) => `user:following:count:${userId}`,
        isFollowing: (a: string, b: string) => `user:follow:${a}:${b}`,
        isBlocked: (a: string, b: string) => `user:block:${a}:${b}`,
        deviceTokens: (userId: string) => `user:devices:${userId}`,
        onlineStatus: (userId: string) => `user:online:${userId}`,
    },
};
