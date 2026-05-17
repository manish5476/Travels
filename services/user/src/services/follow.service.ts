
import { Follow } from '../models/follow.model';
import { User } from '../models/user.model';
import { cache } from '../utils/cache';
import { publishUserEvent } from '../utils/kafkaPublisher';
import { logger } from '../utils/logger';


export const followService = {

    // ── FOLLOW ────────────────────────────────────────────────
    async follow(followerId: string, followingId: string): Promise<void> {
        if (followerId === followingId) {
            throw new Error('Cannot follow yourself');
        }

        // Check target user exists and is not banned
        const target = await User.findById(followingId).select('accountStatus');
        if (!target || target.accountStatus !== 'active') {
            throw new Error('User not found');
        }

        // insertOne — throws duplicate key error if already following
        try {
            await Follow.create({ followerId, followingId });
        } catch (err: any) {
            if (err.code === 11000) return; // Already following — idempotent
            throw err;
        }

        // Atomically update both counters in parallel
        await Promise.all([
            User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
            User.updateOne({ _id: followingId }, { $inc: { followerCount: 1 } }),
        ]);

        // Invalidate caches
        await Promise.all([
            cache.del(cache.keys.profile(followerId)),
            cache.del(cache.keys.profile(followingId)),
            cache.del(cache.keys.isFollowing(followerId, followingId)),
            cache.del(cache.keys.followerCount(followingId)),
            cache.del(cache.keys.followingCount(followerId)),
        ]);

        // Publish event → Feed Service updates follow graph in Redis
        //                → Notification Service alerts the followed user
        await publishUserEvent('user.followed', {
            followerId, followingId, followedAt: new Date().toISOString(),
        });

        logger.info({ followerId, followingId }, 'Follow created');
    },

    // ── UNFOLLOW ──────────────────────────────────────────────
    async unfollow(followerId: string, followingId: string): Promise<void> {
        const result = await Follow.deleteOne({ followerId, followingId });
        if (result.deletedCount === 0) return; // Was not following — idempotent

        await Promise.all([
            User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } }),
            User.updateOne({ _id: followingId }, { $inc: { followerCount: -1 } }),
        ]);

        await Promise.all([
            cache.del(cache.keys.profile(followerId)),
            cache.del(cache.keys.profile(followingId)),
            cache.del(cache.keys.isFollowing(followerId, followingId)),
            cache.del(cache.keys.followerCount(followingId)),
            cache.del(cache.keys.followingCount(followerId)),
        ]);

        logger.info({ followerId, followingId }, 'Unfollow done');
    },

    // ── IS FOLLOWING ─────────────────────────────────────────
    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        const cacheKey = cache.keys.isFollowing(followerId, followingId);
        return cache.getOrFetch(
            cacheKey,
            async () => {
                const doc = await Follow.exists({ followerId, followingId });
                return !!doc;
            },
            120  // 2 minutes
        );
    },

    // ── GET FOLLOWERS ─────────────────────────────────────────
    // Paginated with cursor (createdAt of the follow document)
    async getFollowers(userId: string, cursor?: string, limit = 20) {
        const query: any = { followingId: userId };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const follows = await Follow.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate('followerId', 'username displayName avatarUrl followerCount')
            .lean();

        const hasMore = follows.length > limit;
        const items = hasMore ? follows.slice(0, limit) : follows;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return {
            followers: items.map(f => f.followerId),
            nextCursor,
            total: await Follow.countDocuments({ followingId: userId }),
        };
    },

    // ── GET FOLLOWING ─────────────────────────────────────────
    async getFollowing(userId: string, cursor?: string, limit = 20) {
        const query: any = { followerId: userId };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const follows = await Follow.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .populate('followingId', 'username displayName avatarUrl followerCount')
            .lean();

        const hasMore = follows.length > limit;
        const items = hasMore ? follows.slice(0, limit) : follows;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return {
            following: items.map(f => f.followingId),
            nextCursor,
        };
    },

    // ── GET FOLLOWER IDS (internal — used by Feed Service) ────
    async getFollowerIds(userId: string): Promise<string[]> {
        const follows = await Follow.find({ followingId: userId })
            .select('followerId')
            .lean();
        return follows.map(f => f.followerId.toString());
    },

    // ── GET MUTUAL FOLLOWERS ──────────────────────────────────
    async getMutuals(userAId: string, userBId: string): Promise<string[]> {
        const [aFollows, bFollowedBy] = await Promise.all([
            Follow.find({ followerId: userAId }).select('followingId').lean(),
            Follow.find({ followingId: userBId }).select('followerId').lean(),
        ]);
        const aSet = new Set(aFollows.map(f => f.followingId.toString()));
        return bFollowedBy
            .filter(f => aSet.has(f.followerId.toString()))
            .map(f => f.followerId.toString());
    },
};
