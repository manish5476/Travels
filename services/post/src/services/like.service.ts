
import { Like } from '../models/like.model';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { publishPostEvent } from '../utils/kafkaPublisher';
import { redis } from '../config/redis';

export const likeService = {

    // ── LIKE ──────────────────────────────────────────────────
    async like(targetId: string, targetType: 'post' | 'comment', userId: string): Promise<void> {
        try {
            await Like.create({ targetId, targetType, userId });
        } catch (err: any) {
            if (err.code === 11000) return; // Already liked — idempotent
            throw err;
        }

        // Atomically increment the counter
        if (targetType === 'post') {
            await Post.updateOne({ _id: targetId }, { $inc: { likeCount: 1 } });
            // Cache the new like status
            await redis.setex(`like:post:${userId}:${targetId}`, 3600, '1');
            // Publish for notification + ML scoring
            publishPostEvent('post.engaged', {
                postId: targetId, userId, action: 'like',
                weight: 0.15, engagedAt: new Date().toISOString(),
            });
        } else {
            await Comment.updateOne({ _id: targetId }, { $inc: { likeCount: 1 } });
        }
    },

    // ── UNLIKE ────────────────────────────────────────────────
    async unlike(targetId: string, targetType: 'post' | 'comment', userId: string): Promise<void> {
        const result = await Like.deleteOne({ targetId, targetType, userId });
        if (result.deletedCount === 0) return; // Not liked — idempotent

        if (targetType === 'post') {
            await Post.updateOne({ _id: targetId }, { $inc: { likeCount: -1 } });
            await redis.del(`like:post:${userId}:${targetId}`);
        } else {
            await Comment.updateOne({ _id: targetId }, { $inc: { likeCount: -1 } });
        }
    },

    // ── IS LIKED ──────────────────────────────────────────────
    async isLiked(targetId: string, targetType: 'post' | 'comment', userId: string): Promise<boolean> {
        if (targetType === 'post') {
            const cached = await redis.get(`like:post:${userId}:${targetId}`);
            if (cached !== null) return cached === '1';
        }
        const exists = await Like.exists({ targetId, targetType, userId });
        return !!exists;
    },

    // ── BULK CHECK ────────────────────────────────────────────
    // Check if user liked multiple posts at once (for feed rendering)
    async isLikedBulk(postIds: string[], userId: string): Promise<Record<string, boolean>> {
        const likes = await Like.find({
            targetId: { $in: postIds },
            targetType: 'post',
            userId,
        }).select('targetId').lean();

        const likedSet = new Set(likes.map(l => l.targetId.toString()));
        return Object.fromEntries(postIds.map(id => [id, likedSet.has(id)]));
    },

    // ── GET LIKERS (who liked a post) ─────────────────────────
    async getLikers(postId: string, cursor?: string, limit = 20) {
        const query: any = { targetId: postId, targetType: 'post' };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const likes = await Like.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = likes.length > limit;
        const items = hasMore ? likes.slice(0, limit) : likes;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { userIds: items.map(l => l.userId.toString()), nextCursor };
    },
};
