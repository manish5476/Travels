
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { Post } from '../models/post.model';
import { config } from '../config';
import { logger } from '../utils/logger';

// Signal weights (same as feed ranking engine — must stay in sync)
const WEIGHTS = {
    save: 0.35,
    share: 0.28,
    comment: 0.25,
    like: 0.15,
};

// In-memory accumulator: postId → { action → total weight }
const scoreAccumulator = new Map<string, number>();

let consumer: Consumer | null = null;

export async function startEngagementWorker(): Promise<void> {
    const kafka = new Kafka({ clientId: `${config.serviceName}-engagement`, brokers: config.kafka.brokers });
    consumer = kafka.consumer({ groupId: 'post-engagement-score-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'post.engaged', fromBeginning: false });

    await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload) => {
            const event = JSON.parse(message.value!.toString());
            const { postId, action, weight } = event;
            if (!postId || !weight) return;

            // Accumulate score contribution
            const current = scoreAccumulator.get(postId) || 0;
            scoreAccumulator.set(postId, current + weight);
        },
    });

    // Flush accumulated scores to DB every 15 minutes
    setInterval(async () => {
        await flushScores();
    }, 15 * 60 * 1000);

    // Also sync view counts every 5 minutes
    const { postService } = await import('../services/post.service');
    setInterval(async () => {
        await postService.syncViewCounts().catch(err =>
            logger.error({ err }, 'View count sync failed'));
    }, 5 * 60 * 1000);

    logger.info('Engagement score worker started');
}

async function flushScores(): Promise<void> {
    if (scoreAccumulator.size === 0) return;

    const ops = [];
    for (const [postId, scoreIncrease] of scoreAccumulator.entries()) {
        // Apply recency decay: existing score × 0.95 + new signals
        ops.push({
            updateOne: {
                filter: { _id: postId },
                update: [{
                    $set: {
                        engagementScore: {
                            $add: [{ $multiply: ['$engagementScore', 0.95] }, scoreIncrease],
                        },
                    }
                }],
            },
        });
    }

    scoreAccumulator.clear();

    try {
        await Post.bulkWrite(ops);
        logger.info({ count: ops.length }, 'Engagement scores flushed to DB');
    } catch (err) {
        logger.error({ err }, 'Failed to flush engagement scores');
    }
}
