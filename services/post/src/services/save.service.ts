
import { Save } from '../models/save.model';
import { Post } from '../models/post.model';
import { publishPostEvent } from '../utils/kafkaPublisher';

export const saveService = {

    async save(postId: string, userId: string): Promise<void> {
        try {
            await Save.create({ postId, userId });
        } catch (err: any) {
            if (err.code === 11000) return; // Already saved — idempotent
            throw err;
        }
        await Post.updateOne({ _id: postId }, { $inc: { saveCount: 1 } });
        // Save is the strongest engagement signal (weight 0.35)
        publishPostEvent('post.engaged', {
            postId, userId, action: 'save', weight: 0.35,
            engagedAt: new Date().toISOString(),
        });
    },

    async unsave(postId: string, userId: string): Promise<void> {
        const result = await Save.deleteOne({ postId, userId });
        if (result.deletedCount === 0) return;
        await Post.updateOne({ _id: postId }, { $inc: { saveCount: -1 } });
    },

    async isSaved(postId: string, userId: string): Promise<boolean> {
        const exists = await Save.exists({ postId, userId });
        return !!exists;
    },

    // Get all saved posts for a user (profile Saved tab)
    async getSavedByUser(userId: string, cursor?: string, limit = 20) {
        const query: any = { userId };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const saves = await Save.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = saves.length > limit;
        const items = hasMore ? saves.slice(0, limit) : saves;
        const postIds = items.map(s => s.postId.toString());
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { postIds, nextCursor };
    },
};
