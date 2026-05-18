
import { Client } from '@elastic/elasticsearch';
import { config } from './index';
import { logger } from '../utils/logger';

export const esClient = new Client({
    node: config.elasticsearch.url,
    ...(config.elasticsearch.username ? {
        auth: { username: config.elasticsearch.username, password: config.elasticsearch.password },
    } : {}),
    maxRetries: 3,
    requestTimeout: 10000,
    sniffOnStart: false,
});

// ── POST INDEX MAPPING ────────────────────────────────────────
export const POST_INDEX = 'tripparty_posts';

export async function bootstrapElasticsearch(): Promise<void> {
    try {
        const exists = await esClient.indices.exists({ index: POST_INDEX });
        if (exists) { logger.info('Elasticsearch index already exists'); return; }

        await esClient.indices.create({
            index: POST_INDEX,
            body: {
                settings: {
                    number_of_shards: 2,
                    number_of_replicas: 1,
                    analysis: {
                        analyzer: {
                            hashtag_analyzer: {
                                type: 'custom',
                                tokenizer: 'whitespace',
                                filter: ['lowercase'],
                            },
                        },
                    },
                },
                mappings: {
                    properties: {
                        authorId: { type: 'keyword' },
                        tripId: { type: 'keyword' },
                        type: { type: 'keyword' },
                        caption: { type: 'text', analyzer: 'standard' },
                        hashtags: { type: 'keyword' },
                        locationLabel: { type: 'text', analyzer: 'standard' },
                        location: {
                            type: 'geo_point',
                        },
                        engagementScore: { type: 'float' },
                        likeCount: { type: 'integer' },
                        commentCount: { type: 'integer' },
                        createdAt: { type: 'date' },
                        expiresAt: { type: 'date' },
                    },
                },
            },
        });
        logger.info({ index: POST_INDEX }, 'Elasticsearch index created');
    } catch (err) {
        logger.error({ err }, 'Elasticsearch bootstrap failed');
        throw err;
    }
}
