
import { Kafka, Consumer } from 'kafkajs';
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

export async function startTrendingWorker(): Promise<void> {
    const kafka = new Kafka({
        clientId: `${config.serviceName}-trending`,
        brokers: config.kafka.brokers,
    });

    consumer = kafka.consumer({ groupId: 'feed-trending-group' });
    await consumer.connect();
    await consumer.subscribe({
        topics: ['post.created', 'post.engaged', 'location.checkin'],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

            try {
                if (topic === 'post.created') {
                    // Add to trending posts Sorted Set (score = initial engagement)
                    await redis.zadd(`trending:posts:${today}`, 1, event.postId);
                    await redis.expire(`trending:posts:${today}`, 48 * 3600);
                }

                if (topic === 'post.engaged') {
                    // Boost post's trending score by engagement weight
                    await redis.zincrby(`trending:posts:${today}`, event.weight || 0.1, event.postId);
                }

                if (topic === 'location.checkin') {
                    // Track trending destinations
                    if (event.location?.label) {
                        await redis.zincrby('trending:destinations', 1, event.location.label);
                        await redis.expire('trending:destinations', 24 * 3600);
                    }
                }
            } catch (err) {
                logger.error({ err, topic }, 'Trending updater error');
            }
        },
    });

    logger.info('Trending updater worker started');
}

export async function stopTrendingWorker(): Promise<void> {
    if (consumer) { await consumer.disconnect(); consumer = null; }
}
