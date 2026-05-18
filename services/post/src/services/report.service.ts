
import { Report, ReportReason } from '../models/report.model';
import { Post } from '../models/post.model';
import { config } from '../config';
import { logger } from '../utils/logger';

export const reportService = {

    async report(postId: string, reporterId: string, reason: ReportReason, description?: string): Promise<void> {
        try {
            await Report.create({ postId, reporterId, reason, description });
        } catch (err: any) {
            if (err.code === 11000) return; // Already reported this post — idempotent
            throw err;
        }

        // Increment report count on post
        const post = await Post.findOneAndUpdate(
            { _id: postId },
            { $inc: { 'moderation.reportCount': 1 } },
            { new: true }
        ).select('moderation.reportCount moderation.status');

        if (!post) return;

        // Auto-flag if report count exceeds threshold
        if (
            post.moderation.reportCount >= config.moderation.reportAutoFlag &&
            post.moderation.status === 'clean'
        ) {
            await Post.updateOne({ _id: postId }, { 'moderation.status': 'flagged' });
            logger.warn({ postId, reportCount: post.moderation.reportCount }, 'Post auto-flagged from reports');
        }
    },
};
