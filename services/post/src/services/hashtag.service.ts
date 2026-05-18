
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export const hashtagService = {

    // ── EXTRACT FROM CAPTION ──────────────────────────────────
    // Returns clean array of lowercase hashtags without the # symbol
    extract(caption: string): string[] {
        const matches = caption.match(/#([a-zA-Z0-9_]{1,50})/g) || [];
        const unique = [...new Set(matches.map(h => h.slice(1).toLowerCase()))];
        return unique.slice(0, 30); // Max 30 hashtags per post
    },

    // ── INCREMENT TREND COUNTERS ──────────────────────────────
    // Stored as Redis Sorted Set: trending:hashtags:YYYYMMDD
    // Score = post count. Used by Search Service for trending tab.
    async incrementCounts(hashtags: string[]): Promise<void> {
        if (hashtags.length === 0) return;
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = `trending:hashtags:${today}`;

        const pipeline = redis.pipeline();
        hashtags.forEach(tag => pipeline.zincrby(key, 1, tag));
        pipeline.expire(key, 48 * 3600); // Keep for 48 hours
        await pipeline.exec();
    },

    // ── GET TRENDING ──────────────────────────────────────────
    async getTrending(limit = 20): Promise<Array<{ tag: string; count: number }>> {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = `trending:hashtags:${today}`;

        const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
        const trending: Array<{ tag: string; count: number }> = [];

        for (let i = 0; i < results.length; i += 2) {
            trending.push({ tag: results[i], count: parseInt(results[i + 1]) });
        }
        return trending;
    },
};
