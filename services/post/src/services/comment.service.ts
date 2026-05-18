
import { Comment, IComment } from '../models/comment.model';
import { Post } from '../models/post.model';
import { mentionService } from './mention.service';
import { publishPostEvent } from '../utils/kafkaPublisher';
import { logger } from '../utils/logger';

export const commentService = {

    // ── CREATE COMMENT ────────────────────────────────────────
    async create(postId: string, authorId: string, text: string, parentId?: string): Promise<IComment> {
        // Verify post exists and comments are not disabled
        const post = await Post.findOne({ _id: postId, deletedAt: { $exists: false } })
            .select('commentsDisabled authorId');
        if (!post) throw new Error('POST_NOT_FOUND');
        if (post.commentsDisabled) throw new Error('COMMENTS_DISABLED');

        // Extract mentions
        const mentionedUsernames = mentionService.extractUsernames(text);

        const comment = await Comment.create({
            postId, authorId, parentId, text: text.trim(),
        });

        // Increment counters
        if (parentId) {
            // It's a reply — increment parent comment's reply count
            await Comment.updateOne({ _id: parentId }, { $inc: { replyCount: 1 } });
        }
        // Always increment the post's comment count
        await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });

        // Async tasks
        mentionService.processMentions(postId, mentionedUsernames, authorId)
            .catch(err => logger.error({ err }, 'Comment mention processing failed'));

        publishPostEvent('post.engaged', {
            postId, userId: authorId, action: 'comment',
            weight: 0.25, engagedAt: new Date().toISOString(),
        });

        // Notify post author
        publishPostEvent('post.commented', {
            postId, commentId: comment._id.toString(),
            authorId, postAuthorId: post.authorId.toString(),
            textPreview: text.slice(0, 80),
        });

        return comment;
    },

    // ── GET COMMENTS ──────────────────────────────────────────
    async getForPost(postId: string, cursor?: string, limit = 20) {
        const query: any = {
            postId, parentId: { $exists: false },  // Top-level only
            deletedAt: { $exists: false },
        };
        if (cursor) query.createdAt = { $gt: new Date(cursor) };

        const comments = await Comment.find(query)
            .sort({ createdAt: 1 })
            .limit(limit + 1)
            .lean();

        const hasMore = comments.length > limit;
        const items = hasMore ? comments.slice(0, limit) : comments;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { comments: items, nextCursor };
    },

    // ── GET REPLIES ───────────────────────────────────────────
    async getReplies(parentId: string, cursor?: string, limit = 10) {
        const query: any = { parentId, deletedAt: { $exists: false } };
        if (cursor) query.createdAt = { $gt: new Date(cursor) };

        const replies = await Comment.find(query)
            .sort({ createdAt: 1 })
            .limit(limit + 1)
            .lean();

        const hasMore = replies.length > limit;
        const items = hasMore ? replies.slice(0, limit) : replies;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { replies: items, nextCursor };
    },

    // ── DELETE COMMENT ────────────────────────────────────────
    async delete(commentId: string, requesterId: string): Promise<void> {
        const comment = await Comment.findById(commentId);
        if (!comment) throw new Error('COMMENT_NOT_FOUND');
        if (comment.authorId.toString() !== requesterId) throw new Error('FORBIDDEN');

        await Comment.updateOne({ _id: commentId }, { deletedAt: new Date() });

        // Decrement counters
        await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });
        if (comment.parentId) {
            await Comment.updateOne({ _id: comment.parentId }, { $inc: { replyCount: -1 } });
        }
    },
};
