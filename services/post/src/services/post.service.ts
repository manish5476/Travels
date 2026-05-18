
import mongoose from 'mongoose';
import { Post, IPost } from '../models/post.model';
import { hashtagService } from './hashtag.service';
import { mentionService } from './mention.service';
import { moderationService } from './moderation.service';
import { publishPostEvent } from '../utils/kafkaPublisher';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export class PostError extends Error {
    constructor(message: string, public code: string, public status: number) {
        super(message); this.name = 'PostError';
    }
}
const Err = {
    notFound: () => new PostError('Post not found', 'POST_NOT_FOUND', 404),
    forbidden: () => new PostError('You cannot modify this post', 'FORBIDDEN', 403),
    badRequest: (m: string) => new PostError(m, 'BAD_REQUEST', 400),
};

export interface CreatePostDTO {
    authorId: string;
    tripId?: string;
    waypointIndex?: number;
    type: IPost['type'];
    media: IPost['media'];
    caption: string;
    location?: IPost['location'];
    locationLabel?: string;
    placeId?: string;
    taggedVendors?: string[];
    taggedUsers?: string[];
    hideLikeCount?: boolean;
    commentsDisabled?: boolean;
}

export const postService = {

    // ── CREATE ────────────────────────────────────────────────
    async create(dto: CreatePostDTO): Promise<IPost> {
        // Extract hashtags from caption
        const hashtags = hashtagService.extract(dto.caption);

        // Extract @mentions from caption
        const mentionedUsernames = mentionService.extractUsernames(dto.caption);

        // Set TTL for stories (24 hours)
        const expiresAt = dto.type === 'story'
            ? new Date(Date.now() + 24 * 60 * 60 * 1000)
            : undefined;

        const post = await Post.create({
            authorId: new mongoose.Types.ObjectId(dto.authorId),
            tripId: dto.tripId ? new mongoose.Types.ObjectId(dto.tripId) : undefined,
            waypointIndex: dto.waypointIndex,
            type: dto.type,
            media: dto.media,
            caption: dto.caption.trim(),
            hashtags,
            location: dto.location,
            locationLabel: dto.locationLabel,
            placeId: dto.placeId,
            taggedVendors: (dto.taggedVendors || []).map(id => new mongoose.Types.ObjectId(id)),
            taggedUsers: (dto.taggedUsers || []).map(id => new mongoose.Types.ObjectId(id)),
            hideLikeCount: dto.hideLikeCount ?? false,
            commentsDisabled: dto.commentsDisabled ?? false,
            expiresAt,
            moderation: { status: 'pending', aiScores: {}, reportCount: 0 },
        });

        // ── ASYNC POST-CREATION TASKS ──────────────────────────
        // These run in background — do NOT await (don't block response)

        // 1. Run AI content moderation
        moderationService.moderatePost(post).catch(err =>
            logger.error({ err, postId: post._id }, 'Moderation failed'));

        // 2. Update hashtag trending counters
        hashtagService.incrementCounts(hashtags).catch(err =>
            logger.error({ err }, 'Hashtag increment failed'));

        // 3. Resolve @mention user IDs + notify
        mentionService.processMentions(post._id.toString(), mentionedUsernames, dto.authorId)
            .catch(err => logger.error({ err }, 'Mention processing failed'));

        // 4. Publish post.created event → Feed fan-out, Notification, Analytics, Search indexer
        publishPostEvent('post.created', {
            postId: post._id.toString(),
            authorId: dto.authorId,
            tripId: dto.tripId,
            type: dto.type,
            hashtags,
            location: dto.location ? {
                lat: dto.location.coordinates[1],
                lng: dto.location.coordinates[0],
                label: dto.locationLabel,
            } : undefined,
            createdAt: post.createdAt.toISOString(),
        });

        logger.info({ postId: post._id, authorId: dto.authorId, type: dto.type }, 'Post created');
        return post;
    },

    // ── GET BY ID ─────────────────────────────────────────────
    async getById(postId: string, requesterId?: string): Promise<IPost> {
        const post = await Post.findOne({
            _id: postId,
            deletedAt: { $exists: false },
            'moderation.status': { $ne: 'removed' },
        });
        if (!post) throw Err.notFound();

        // Increment view count asynchronously via Redis
        // Synced to MongoDB in background every 5 minutes
        redis.incr(`post:views:${postId}`).catch(() => { });

        return post;
    },

    // ── GET USER POSTS ────────────────────────────────────────
    async getByAuthor(authorId: string, cursor?: string, limit = 20) {
        const query: any = {
            authorId,
            type: { $in: ['post', 'reel'] },
            deletedAt: { $exists: false },
            'moderation.status': { $ne: 'removed' },
        };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { posts: items, nextCursor };
    },

    // ── GET TRIP TIMELINE ─────────────────────────────────────
    // Returns all posts tagged to a trip in chronological order
    async getTripTimeline(tripId: string, cursor?: string, limit = 20) {
        const query: any = {
            tripId,
            deletedAt: { $exists: false },
            'moderation.status': { $ne: 'removed' },
        };
        if (cursor) query.createdAt = { $gt: new Date(cursor) };

        const posts = await Post.find(query)
            .sort({ createdAt: 1 })  // Chronological for trip log
            .limit(limit + 1)
            .lean();

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, limit) : posts;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { posts: items, nextCursor };
    },

    // ── GET BY HASHTAG ────────────────────────────────────────
    async getByHashtag(hashtag: string, cursor?: string, limit = 20) {
        const query: any = {
            hashtags: hashtag.toLowerCase().replace('#', ''),
            type: { $in: ['post', 'reel'] },
            deletedAt: { $exists: false },
            'moderation.status': 'clean',
        };
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const posts = await Post.find(query)
            .sort({ engagementScore: -1, createdAt: -1 })
            .limit(limit + 1)
            .select('_id authorId media caption hashtags likeCount commentCount createdAt')
            .lean();

        const hasMore = posts.length > limit;
        const items = hasMore ? posts.slice(0, limit) : posts;
        return { posts: items, nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null };
    },

    // ── UPDATE ────────────────────────────────────────────────
    async update(postId: string, authorId: string, updates: {
        caption?: string;
        hideLikeCount?: boolean;
        commentsDisabled?: boolean;
    }): Promise<IPost> {
        const post = await Post.findOne({ _id: postId, deletedAt: { $exists: false } });
        if (!post) throw Err.notFound();
        if (post.authorId.toString() !== authorId) throw Err.forbidden();

        if (updates.caption !== undefined) {
            post.caption = updates.caption.trim();
            post.hashtags = hashtagService.extract(updates.caption);
        }
        if (updates.hideLikeCount !== undefined) post.hideLikeCount = updates.hideLikeCount;
        if (updates.commentsDisabled !== undefined) post.commentsDisabled = updates.commentsDisabled;

        await post.save();
        return post;
    },

    // ── SOFT DELETE ───────────────────────────────────────────
    // Never hard-delete — trip log integrity must be preserved
    async softDelete(postId: string, authorId: string): Promise<void> {
        const post = await Post.findOne({ _id: postId, deletedAt: { $exists: false } });
        if (!post) throw Err.notFound();
        if (post.authorId.toString() !== authorId) throw Err.forbidden();

        await Post.updateOne({ _id: postId }, { deletedAt: new Date() });

        // Notify Feed Service to remove from feeds
        publishPostEvent('post.deleted', { postId, authorId });
        logger.info({ postId, authorId }, 'Post soft-deleted');
    },

    // ── SYNC VIEW COUNT ───────────────────────────────────────
    // Called by a cron job every 5 minutes
    // Reads accumulated view counts from Redis → writes to MongoDB in bulk
    async syncViewCounts(): Promise<void> {
        const pattern = 'post:views:*';
        let cursor = '0';
        const ops: any[] = [];

        do {
            const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
            cursor = next;
            for (const key of keys) {
                const count = await redis.getdel(key);
                const postId = key.replace('post:views:', '');
                if (count && parseInt(count) > 0) {
                    ops.push({
                        updateOne: {
                            filter: { _id: postId },
                            update: { $inc: { viewCount: parseInt(count) } },
                        },
                    });
                }
            }
        } while (cursor !== '0');

        if (ops.length > 0) {
            await Post.bulkWrite(ops);
            logger.info({ count: ops.length }, 'View counts synced from Redis to MongoDB');
        }
    },
};
