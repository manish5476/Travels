
import { rankingEngine } from '../algorithms/rankingEngine';
import { redis } from '../config/redis';
import { config } from '../config';
import { FeedKeys } from '../utils/cursor';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

// Minimal post model for DB fallback
const PostModel = mongoose.model('Post', new mongoose.Schema({
    authorId: mongoose.Types.ObjectId,
    type: String, tripId: mongoose.Types.ObjectId,
    locationLabel: String, engagementScore: Number,
    'moderation.status': String, createdAt: Date,
}, { versionKey: false }), 'Post');

export const feedService = {

    // ── BUILD HOME FEED ───────────────────────────────────────
    async getHomeFeed(userId: string, cursor?: string, limit = 20) {
        return rankingEngine.buildFeed(userId, cursor, limit);
    },

    // ── INVALIDATE USER FEED ──────────────────────────────────
    // Called when user unfollows someone — remove their posts from feed
    async removeAuthorFromFeed(userId: string, authorId: string): Promise<void> {
        const key = FeedKeys.userFeed(userId);
        // Get all post IDs in feed
        const postIds = await redis.zrange(key, 0, -1);

        // Find posts by this author (from metadata)
        const toRemove: string[] = [];
        for (const postId of postIds) {
            const meta = await redis.hget(FeedKeys.postMeta(postId), 'authorId');
            if (meta === authorId) toRemove.push(postId);
        }

        if (toRemove.length > 0) {
            await redis.zrem(key, ...toRemove);
            logger.info({ userId, authorId, removedCount: toRemove.length }, 'Author posts removed from feed');
        }
    },

    // ── UPDATE USER FEATURES ──────────────────────────────────
    // Called by trip.state_changed event — updates active trip context
    async updateUserFeatures(userId: string, features: Record<string, string>): Promise<void> {
        const key = FeedKeys.userFeatures(userId);
        await redis.hset(key, features);
        await redis.expire(key, 30 * 60); // 30 minutes
    },

    // ── EXPLORE: NEARBY POSTS ─────────────────────────────────
    async getNearbyPosts(lat: number, lng: number, radiusKm = 50, limit = 20) {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const posts = await PostModel.find({
            location: {
                $nearSphere: {
                    $geometry: { type: 'Point', coordinates: [lng, lat] },
                    $maxDistance: radiusKm * 1000,
                },
            },
            createdAt: { $gte: cutoff },
            'moderation.status': 'clean',
            type: { $in: ['post', 'reel'] },
        })
            .sort({ engagementScore: -1 })
            .limit(limit)
            .select('_id authorId type locationLabel engagementScore createdAt')
            .lean();

        return posts;
    },
};
