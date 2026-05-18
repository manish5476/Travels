
import { redis } from '../config/redis';
import { config } from '../config';
import { FeedKeys } from '../utils/cursor';
import { logger } from '../utils/logger';

interface FanOutEvent {
    postId: string;
    authorId: string;
    tripId?: string;
    type: string;
    locationLabel?: string;
    engagementScore: number;
    createdAt: string;
}

export const fanoutService = {

    // ── FAN OUT A NEW POST ────────────────────────────────────
    async fanOut(event: FanOutEvent, followerIds: string[]): Promise<void> {
        if (followerIds.length === 0) return;

        // Check follower count to decide push vs pull strategy
        const followerCountStr = await redis.get(FeedKeys.followerCount(event.authorId));
        const followerCount = parseInt(followerCountStr || '0');
        const isInfluencer = followerCount > config.feed.influencerThreshold;

        if (isInfluencer) {
            // ── PULL STRATEGY ─────────────────────────────────
            // Store in author's influencer sorted set.
            // Feed service merges this at read time.
            await redis.zadd(
                FeedKeys.influencerPosts(event.authorId),
                event.engagementScore,
                event.postId
            );
            await redis.expire(FeedKeys.influencerPosts(event.authorId), 6 * 3600);
            logger.info({ authorId: event.authorId, postId: event.postId }, 'Influencer post → pull strategy');
            return;
        }

        // ── PUSH STRATEGY ─────────────────────────────────────
        // Write post_id + score into EACH follower's Redis Sorted Set.
        // Process in batches of 100 to avoid blocking Redis.
        const BATCH_SIZE = 100;
        let pushed = 0;

        for (let i = 0; i < followerIds.length; i += BATCH_SIZE) {
            const batch = followerIds.slice(i, i + BATCH_SIZE);
            const pipeline = redis.pipeline();

            for (const followerId of batch) {
                const feedKey = FeedKeys.userFeed(followerId);
                // ZADD: add postId with score (higher score = shown first)
                pipeline.zadd(feedKey, event.engagementScore, event.postId);
                // Trim feed to maxSize to prevent unbounded growth
                pipeline.zremrangebyrank(feedKey, 0, -(config.feed.maxSize + 1));
                // Set TTL on the feed key
                pipeline.expire(feedKey, config.feed.ttlSeconds);
            }

            await pipeline.exec();
            pushed += batch.length;
        }

        // ── CACHE POST METADATA ───────────────────────────────
        // Store minimal post data in Redis Hash for fast candidate enrichment
        await redis.hset(FeedKeys.postMeta(event.postId), {
            authorId: event.authorId,
            tripId: event.tripId || '',
            type: event.type,
            locationLabel: event.locationLabel || '',
            createdAt: event.createdAt,
            likeCount: '0',
            commentCount: '0',
            saveCount: '0',
            viewCount: '0',
            moderationStatus: 'pending',
        });
        await redis.expire(FeedKeys.postMeta(event.postId), 48 * 3600); // 48h

        logger.info({
            postId: event.postId, authorId: event.authorId,
            followerCount: followerIds.length, pushed,
        }, 'Fan-out complete');
    },

    // ── UPDATE POST META IN CACHE ─────────────────────────────
    // Called by engagement events to keep Redis counters fresh
    async updatePostMeta(postId: string, field: string, increment: number): Promise<void> {
        await redis.hincrbyfloat(FeedKeys.postMeta(postId), field, increment);
    },
};
