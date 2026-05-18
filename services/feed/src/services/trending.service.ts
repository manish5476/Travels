
import { redis } from '../config/redis';
import mongoose from 'mongoose';

const PostModel = mongoose.model('Post', new mongoose.Schema({
    authorId: mongoose.Types.ObjectId, type: String,
    hashtags: [String], locationLabel: String,
    engagementScore: Number, 'moderation.status': String, createdAt: Date,
}, { versionKey: false }), 'Post');

export const trendingService = {

    // ── GET TRENDING HASHTAGS ─────────────────────────────────
    async getTrendingHashtags(limit = 20): Promise<Array<{ tag: string; count: number }>> {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = `trending:hashtags:${today}`;
        const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

        const trending: Array<{ tag: string; count: number }> = [];
        for (let i = 0; i < results.length; i += 2) {
            trending.push({ tag: results[i], count: parseInt(results[i + 1]) });
        }
        return trending;
    },

    // ── GET EXPLORE POSTS ─────────────────────────────────────
    // High-engagement posts from the past 48 hours for the Explore tab
    async getExplorePosts(limit = 30): Promise<any[]> {
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
        return PostModel.find({
            createdAt: { $gte: cutoff },
            'moderation.status': 'clean',
            type: { $in: ['post', 'reel'] },
        })
            .sort({ engagementScore: -1 })
            .limit(limit)
            .select('_id authorId type locationLabel engagementScore likeCount createdAt')
            .lean();
    },

    // ── GET TRENDING DESTINATIONS ─────────────────────────────
    // Cities with the most active trips right now
    async getTrendingDestinations(limit = 10): Promise<Array<{ city: string; count: number }>> {
        const key = 'trending:destinations';
        const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

        const destinations: Array<{ city: string; count: number }> = [];
        for (let i = 0; i < results.length; i += 2) {
            destinations.push({ city: results[i], count: parseInt(results[i + 1]) });
        }
        return destinations;
    },
};
