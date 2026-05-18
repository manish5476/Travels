
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from './logger';

// ── HOW IT WORKS ──────────────────────────────────────────
// A Bloom filter is a probabilistic data structure.
// We hash each post_id into K bit positions in a Redis bit array.
// On CHECK: if ALL K bits are set → 'probably seen' (1% false positive).
// On ADD:   set ALL K bits for the post_id.
// NEVER returns false negatives (if not seen, it WILL be shown).
// Memory: ~1.2MB for 10M items at 1% FPR (vs ~80MB for a plain Set).

const K = 7;  // Number of hash functions
const BLOOM_TTL = 7 * 24 * 3600;  // 7 days

// Simple deterministic hash functions using FNV-1a variants
function hash(item: string, seed: number, size: number): number {
    let h = seed ^ 0x9e3779b9;
    for (let i = 0; i < item.length; i++) {
        h = Math.imul(h ^ item.charCodeAt(i), 0x517cc1b727220a95);
        h = (h << 13) | (h >>> 19);
    }
    return Math.abs(h) % size;
}

// Bloom filter size (bits) for expected items and FPR
function bloomSize(n: number, fpr: number): number {
    return Math.ceil(-n * Math.log(fpr) / (Math.log(2) ** 2));
}

const BLOOM_SIZE = bloomSize(
    config.bloom.expectedItems,
    config.bloom.falsePositiveRate
);

export const bloomFilter = {

    // ── CHECK (has user seen this post?) ────────────────────
    async mightHaveSeen(userId: string, postId: string): Promise<boolean> {
        try {
            const key = `bloom:seen:${userId}`;
            const pipeline = redis.pipeline();

            for (let i = 0; i < K; i++) {
                const bit = hash(postId, i * 0x5851f42d, BLOOM_SIZE);
                pipeline.getbit(key, bit);
            }

            const results = await pipeline.exec();
            if (!results) return false;

            // All K bits must be set for a 'probably seen' result
            return results.every(([err, val]) => !err && val === 1);
        } catch (err) {
            logger.warn({ err, userId, postId }, 'Bloom filter check failed — assuming unseen');
            return false;  // Fail open: show the post if uncertain
        }
    },

    // ── MARK (record that user has seen this post) ───────────
    async markSeen(userId: string, postId: string): Promise<void> {
        try {
            const key = `bloom:seen:${userId}`;
            const pipeline = redis.pipeline();

            for (let i = 0; i < K; i++) {
                const bit = hash(postId, i * 0x5851f42d, BLOOM_SIZE);
                pipeline.setbit(key, bit, 1);
            }
            pipeline.expire(key, BLOOM_TTL);

            await pipeline.exec();
        } catch (err) {
            logger.warn({ err }, 'Bloom filter markSeen failed — non-fatal');
        }
    },

    // ── MARK BATCH ───────────────────────────────────────────
    async markSeenBatch(userId: string, postIds: string[]): Promise<void> {
        if (postIds.length === 0) return;
        try {
            const key = `bloom:seen:${userId}`;
            const pipeline = redis.pipeline();

            for (const postId of postIds) {
                for (let i = 0; i < K; i++) {
                    const bit = hash(postId, i * 0x5851f42d, BLOOM_SIZE);
                    pipeline.setbit(key, bit, 1);
                }
            }
            pipeline.expire(key, BLOOM_TTL);
            await pipeline.exec();
        } catch (err) {
            logger.warn({ err }, 'Bloom filter batch markSeen failed');
        }
    },

    // ── RESET (for testing / account reset) ─────────────────
    async reset(userId: string): Promise<void> {
        await redis.del(`bloom:seen:${userId}`);
    },
};
