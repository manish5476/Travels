
import {
    RekognitionClient,
    DetectModerationLabelsCommand,
} from '@aws-sdk/client-rekognition';
import { Post, IPost } from '../models/post.model';
import { config } from '../config';
import { logger } from '../utils/logger';

const rekognition = new RekognitionClient({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});

export const moderationService = {

    // ── MODERATE POST ─────────────────────────────────────────
    // Called asynchronously after post creation
    // Scans all photo media items for NSFW / violence content
    async moderatePost(post: IPost): Promise<void> {
        const photoMedia = post.media.filter(m => m.type === 'photo');
        if (photoMedia.length === 0) {
            // No photos — mark clean immediately
            await Post.updateOne({ _id: post._id }, { 'moderation.status': 'clean' });
            return;
        }

        let highestNsfwScore = 0;
        let highestViolenceScore = 0;

        for (const mediaItem of photoMedia) {
            try {
                const scores = await this.analyzeImage(mediaItem.url);
                highestNsfwScore = Math.max(highestNsfwScore, scores.nsfw);
                highestViolenceScore = Math.max(highestViolenceScore, scores.violence);
            } catch (err) {
                logger.warn({ err, url: mediaItem.url }, 'Rekognition failed for image — skipping');
            }
        }

        const status: IPost['moderation']['status'] =
            highestNsfwScore >= config.moderation.nsfwThreshold ? 'flagged' :
                highestViolenceScore >= config.moderation.nsfwThreshold ? 'flagged' : 'clean';

        await Post.updateOne({ _id: post._id }, {
            'moderation.status': status,
            'moderation.aiScores.nsfw': highestNsfwScore,
            'moderation.aiScores.violence': highestViolenceScore,
        });

        if (status === 'flagged') {
            logger.warn({ postId: post._id, highestNsfwScore }, 'Post auto-flagged by AI moderation');
        } else {
            logger.info({ postId: post._id }, 'Post moderation passed — status: clean');
        }
    },

    // ── ANALYZE SINGLE IMAGE ──────────────────────────────────
    async analyzeImage(imageUrl: string): Promise<{ nsfw: number; violence: number }> {
        // Parse S3 bucket and key from CDN URL
        // CDN URL: https://cdn.tripparty.in/posts/uuid/0.jpg
        // S3 key:  posts/uuid/0.jpg
        const urlParts = new URL(imageUrl);
        const s3Key = urlParts.pathname.slice(1); // Remove leading /

        const command = new DetectModerationLabelsCommand({
            Image: {
                S3Object: {
                    Bucket: process.env.S3_MEDIA_BUCKET!,
                    Name: s3Key,
                },
            },
            MinConfidence: 50,
        });

        const response = await rekognition.send(command);
        const labels = response.ModerationLabels || [];

        let nsfw = 0;
        let violence = 0;

        for (const label of labels) {
            const confidence = (label.Confidence || 0) / 100;
            const name = (label.Name || '').toLowerCase();

            if (name.includes('nudity') || name.includes('explicit') || name.includes('sexual')) {
                nsfw = Math.max(nsfw, confidence);
            }
            if (name.includes('violence') || name.includes('graphic')) {
                violence = Math.max(violence, confidence);
            }
        }

        return { nsfw, violence };
    },
};