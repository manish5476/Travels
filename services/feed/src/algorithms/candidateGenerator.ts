
import { redis } from '../config/redis';
import { config } from '../config';
import { FeedKeys } from '../utils/cursor';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

// Lightweight candidate type — no full post data yet
export interface Candidate {
    postId: string;
    authorId: string;
    source: 'following' | 'trending' | 'interest';
    engagementScore: number;  // Redis Sorted Set score
    createdAt: string;
    type: string;
    isTravelContent: boolean;
    locationLabel?: string;
}

// Simple MongoDB Post model (read-only — minimal fields)
const PostModel = mongoose.model('Post', new mongoose.Schema({
    authorId: mongoose.Types.ObjectId,
    type: String,
    tripId: mongoose.Types.ObjectId,
    hashtags: [String],
    locationLabel: String,
    engagementScore: Number,
    'moderation.status': String,
    createdAt: Date,
}, { timestamps: false, versionKey: false }), 'Post');

export const candidateGenerator = {

    async generate(userId: string, targetCount: number): Promise<Candidate[]> {
        const [followingPosts, trendingPosts, interestPosts] = await Promise.all([
            this.getFollowingCandidates(userId, config.feed.maxFollowingCandidates),
            this.getTrendingCandidates(config.feed.maxTrendingCandidates),
            this.getInterestCandidates(userId, config.feed.maxInterestCandidates),
        ]);

        // Deduplicate by postId (following pool takes priority)
        const seen = new Set<string>();
        const merged: Candidate[] = [];

        for (const c of [...followingPosts, ...trendingPosts, ...interestPosts]) {
            if (!seen.has(c.postId) && merged.length < targetCount) {
                seen.add(c.postId);
                merged.push(c);
            }
        }

        logger.debug({
            userId,
            following: followingPosts.length,
            trending: trendingPosts.length,
            interest: interestPosts.length,
            merged: merged.length,
        }, 'Candidates generated');

        return merged;
    },

    // ── POOL 1: Following Posts ─────────────────────────────
    // Read from Redis Sorted Set: feed:{userId}
    // Score = ranking_score. Set by fan-out worker on post creation.
    async getFollowingCandidates(userId: string, limit: number): Promise<Candidate[]> {
        const key = FeedKeys.userFeed(userId);
        // ZREVRANGE: highest score first, with scores
        const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

        const candidates: Candidate[] = [];
        for (let i = 0; i < results.length; i += 2) {
            const postId = results[i];
            const score = parseFloat(results[i + 1]);

            // Fetch post metadata from cache
            const meta = await redis.hgetall(FeedKeys.postMeta(postId));
            if (!meta || !meta.authorId) continue;
            if (meta.moderationStatus === 'removed') continue;

            candidates.push({
                postId,
                authorId: meta.authorId,
                source: 'following',
                engagementScore: score,
                createdAt: meta.createdAt || '',
                type: meta.type || 'post',
                isTravelContent: meta.tripId ? true : false,
                locationLabel: meta.locationLabel,
            });
        }

        return candidates;
    },

    // ── POOL 2: Trending Posts ──────────────────────────────
    // Top posts from today's trending Sorted Set
    async getTrendingCandidates(limit: number): Promise<Candidate[]> {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const key = FeedKeys.trendingPosts(today);
        const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

        const candidates: Candidate[] = [];
        for (let i = 0; i < results.length; i += 2) {
            const postId = results[i];
            const score = parseFloat(results[i + 1]);
            const meta = await redis.hgetall(FeedKeys.postMeta(postId));
            if (!meta?.authorId) continue;

            candidates.push({
                postId, source: 'trending',
                authorId: meta.authorId,
                engagementScore: score,
                createdAt: meta.createdAt || '',
                type: meta.type || 'post',
                isTravelContent: meta.tripId ? true : false,
                locationLabel: meta.locationLabel,
            });
        }
        return candidates;
    },

    // ── POOL 3: Interest-Based Posts ────────────────────────
    // Posts tagged with hashtags matching user's interest preferences
    async getInterestCandidates(userId: string, limit: number): Promise<Candidate[]> {
        // Fetch user's interest tags from cached user features
        const features = await redis.hgetall(FeedKeys.userFeatures(userId));
        if (!features?.interests) return [];

        let interests: string[] = [];
        try { interests = JSON.parse(features.interests); } catch { return []; }
        if (interests.length === 0) return [];

        // Pick a random interest tag to add variety
        const tag = interests[Math.floor(Math.random() * interests.length)];

        // Query MongoDB for recent posts with this hashtag
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
        const posts = await PostModel.find({
            hashtags: tag,
            createdAt: { $gte: cutoff },
            'moderation.status': 'clean',
        })
            .sort({ engagementScore: -1 })
            .limit(limit)
            .select('_id authorId type tripId locationLabel engagementScore createdAt')
            .lean();

        return posts.map((p: any) => ({
            postId: p._id.toString(),
            authorId: p.authorId.toString(),
            source: 'interest' as const,
            engagementScore: p.engagementScore || 0,
            createdAt: p.createdAt.toISOString(),
            type: p.type || 'post',
            isTravelContent: !!p.tripId,
            locationLabel: p.locationLabel,
        }));
    },
};
