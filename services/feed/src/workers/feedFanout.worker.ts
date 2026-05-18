
import { Kafka, Consumer } from 'kafkajs';
import { fanoutService } from '../services/fanout.service';
import { feedService } from '../services/feed.service';
import { redis } from '../config/redis';
import { config } from '../config';
import { FeedKeys } from '../utils/cursor';
import { logger } from '../utils/logger';

let consumer: Consumer | null = null;

// ── FETCH FOLLOWER IDs ─────────────────────────────────────
// Calls User Service internal API
async function getFollowerIds(authorId: string): Promise<string[]> {
    try {
        const res = await fetch(
            `${config.services.userUrl}/internal/${authorId}/follower-ids`,
            { headers: { 'x-internal-service': 'feed-service' } }
        );
        if (!res.ok) return [];
        const data = await res.json() as { data: string[] };
        return data.data || [];
    } catch (err) {
        logger.error({ err, authorId }, 'Failed to fetch follower IDs');
        return [];
    }
}

export async function startFanoutWorker(): Promise<void> {
    const kafka = new Kafka({
        clientId: `${config.serviceName}-fanout`,
        brokers: config.kafka.brokers,
        ssl: config.isProd,
    });

    consumer = kafka.consumer({ groupId: 'feed-fanout-group' });
    await consumer.connect();

    await consumer.subscribe({
        topics: [
            'post.created',      // Fan-out new posts
            'post.deleted',      // Remove from feeds
            'post.engaged',      // Update post meta cache
            'user.followed',     // Update follow graph
            'trip.state_changed',// Update user features (active trip)
        ],
        fromBeginning: false,
    });

    await consumer.run({
        // Process messages concurrently (partitions run in parallel)
        partitionsConsumedConcurrently: 3,

        eachMessage: async ({ topic, message }) => {
            const event = JSON.parse(message.value!.toString());

            try {
                switch (topic) {

                    case 'post.created': {
                        const { postId, authorId, tripId, type, locationLabel, createdAt } = event;

                        // Get follower IDs from User Service
                        const followerIds = await getFollowerIds(authorId);

                        // Fan-out to all follower feeds
                        await fanoutService.fanOut({
                            postId, authorId, tripId, type, locationLabel,
                            engagementScore: 1.0, // Fresh post starts with score 1.0
                            createdAt,
                        }, followerIds);

                        // Update follower count cache
                        await redis.set(FeedKeys.followerCount(authorId), followerIds.length.toString());
                        break;
                    }

                    case 'post.deleted': {
                        // Remove from influencer sorted set if applicable
                        await redis.zrem(FeedKeys.influencerPosts(event.authorId), event.postId);
                        // Remove post meta from cache
                        await redis.del(FeedKeys.postMeta(event.postId));
                        break;
                    }

                    case 'post.engaged': {
                        // Update post engagement score in Redis meta cache
                        // So candidate generator sees updated score
                        const { postId, action, weight } = event;
                        await fanoutService.updatePostMeta(postId, 'engagementScore', weight);

                        // Update specific counter (likeCount, saveCount, etc.)
                        const counterMap: Record<string, string> = {
                            like: 'likeCount', save: 'saveCount',
                            comment: 'commentCount', share: 'shareCount',
                        };
                        if (counterMap[action]) {
                            await redis.hincrby(FeedKeys.postMeta(postId), counterMap[action], 1);
                        }
                        break;
                    }

                    case 'user.followed': {
                        // When user follows someone, add their recent posts to the feed
                        // This makes the feed immediately feel populated after following
                        const { followerId, followingId } = event;
                        const recentPostIds = await redis.zrevrange(
                            FeedKeys.influencerPosts(followingId), 0, 9
                        );
                        if (recentPostIds.length > 0) {
                            const pipeline = redis.pipeline();
                            recentPostIds.forEach(postId => {
                                pipeline.zadd(FeedKeys.userFeed(followerId), 1.0, postId);
                            });
                            await pipeline.exec();
                        }
                        break;
                    }

                    case 'trip.state_changed': {
                        // When trip becomes active, update user features so feed boosts travel content
                        if (event.toState === 'active') {
                            await feedService.updateUserFeatures(event.adminId, {
                                has_active_trip: 'true',
                                active_trip_id: event.tripId,
                            });
                            // Update for all collaborators too
                            for (const collabId of (event.collaboratorIds || [])) {
                                await feedService.updateUserFeatures(collabId, { has_active_trip: 'true' });
                            }
                        } else if (event.toState === 'completed') {
                            await feedService.updateUserFeatures(event.adminId, { has_active_trip: 'false' });
                        }
                        break;
                    }
                }
            } catch (err) {
                logger.error({ err, topic, event }, 'Fan-out worker error');
            }
        },
    });

    logger.info('Feed fan-out worker started');
}

export async function stopFanoutWorker(): Promise<void> {
    if (consumer) { await consumer.disconnect(); consumer = null; }
}
