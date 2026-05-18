
import { redis } from '../config/redis';
import { FeedKeys } from '../utils/cursor';
import mongoose from 'mongoose';

const StoryModel = mongoose.model('Post', new mongoose.Schema({
    authorId: mongoose.Types.ObjectId,
    type: String, expiresAt: Date,
    'moderation.status': String, createdAt: Date,
}, { versionKey: false }), 'Post');

export interface StoryTrayItem {
    authorId: string;
    storyIds: string[];
    hasUnread: boolean;
    latestAt: string;
}

export const storyTrayService = {

    // ── GET STORY TRAY ────────────────────────────────────────
    // Returns list of users who have active stories, grouped by author.
    // Ordered by: unread first, then by recency.
    async getTray(userId: string, followingIds: string[]): Promise<StoryTrayItem[]> {
        if (followingIds.length === 0) return [];

        const now = new Date();

        // Fetch all active stories from followed users
        const stories = await StoryModel.find({
            authorId: { $in: followingIds.map(id => new mongoose.Types.ObjectId(id)) },
            type: 'story',
            expiresAt: { $gt: now },
            'moderation.status': { $ne: 'removed' },
        })
            .sort({ createdAt: -1 })
            .select('_id authorId createdAt')
            .lean();

        // Group by authorId
        const authorMap = new Map<string, { storyIds: string[], latestAt: Date }>();
        for (const story of stories) {
            if (!story.authorId || !story.createdAt) continue;
            const aid = story.authorId.toString();
            if (!authorMap.has(aid)) {
                authorMap.set(aid, { storyIds: [], latestAt: story.createdAt as any as Date });
            }
            authorMap.get(aid)!.storyIds.push(story._id.toString());
        }

        // Check which stories are unread
        const seenKey = `story:seen:${userId}`;
        const seenIds = new Set(await redis.smembers(seenKey));

        const tray: StoryTrayItem[] = [];
        for (const [authorId, data] of authorMap.entries()) {
            const hasUnread = data.storyIds.some(id => !seenIds.has(id));
            tray.push({
                authorId,
                storyIds: data.storyIds,
                hasUnread,
                latestAt: data.latestAt.toISOString(),
            });
        }

        // Sort: unread first, then by latestAt desc
        return tray.sort((a, b) => {
            if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
            return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
        });
    },

    // ── MARK STORY AS SEEN ────────────────────────────────────
    async markSeen(userId: string, storyId: string): Promise<void> {
        const key = `story:seen:${userId}`;
        await redis.sadd(key, storyId);
        await redis.expire(key, 25 * 3600); // Slightly > 24h story TTL
    },
};
