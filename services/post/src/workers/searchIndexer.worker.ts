
import { Kafka, Consumer } from 'kafkajs';
import { esClient, POST_INDEX } from '../config/elasticsearch';
import { Post } from '../models/post.model';
import { config } from '../config';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

export async function startSearchIndexer(): Promise<void> {
    const kafka = new Kafka({ clientId: `${config.serviceName}-indexer`, brokers: config.kafka.brokers });
    consumer = kafka.consumer({ groupId: 'post-search-indexer-group' });
    await consumer.connect();
    await consumer.subscribe({
        topics: ['post.created', 'post.deleted'],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());

            if (topic === 'post.created') {
                await indexPost(event.postId);
            } else if (topic === 'post.deleted') {
                await removeFromIndex(event.postId);
            }
        },
    });

    logger.info('Search indexer worker started');
}

async function indexPost(postId: string): Promise<void> {
    try {
        const post = await Post.findById(postId).lean();
        if (!post || post.moderation.status === 'removed') return;

        await esClient.index({
            index: POST_INDEX,
            id: postId,
            body: {
                authorId: post.authorId.toString(),
                tripId: post.tripId?.toString(),
                type: post.type,
                caption: post.caption,
                hashtags: post.hashtags,
                locationLabel: post.locationLabel,
                location: post.location ? {
                    lat: post.location.coordinates[1],
                    lon: post.location.coordinates[0],
                } : null,
                likeCount: post.likeCount,
                commentCount: post.commentCount,
                engagementScore: post.engagementScore,
                createdAt: post.createdAt,
                expiresAt: post.expiresAt,
            },
        });
        logger.info({ postId }, 'Post indexed in Elasticsearch');
    } catch (err) {
        logger.error({ err, postId }, 'Failed to index post');
    }
}

async function removeFromIndex(postId: string): Promise<void> {
    try {
        await esClient.delete({ index: POST_INDEX, id: postId });
        logger.info({ postId }, 'Post removed from Elasticsearch');
    } catch (err: any) {
        if (err.meta?.statusCode !== 404) {
            logger.error({ err, postId }, 'Failed to remove post from index');
        }
    }
}
