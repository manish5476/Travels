
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('8003'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('feed-service'),
    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().min(5),
    REDIS_DB: z.string().default('3'),
    JWT_PUBLIC_KEY: z.string().min(100),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),
    KAFKA_BROKERS: z.string().min(5),
    // Internal service URLs
    USER_SERVICE_URL: z.string().url().default('http://user:8002'),
    POST_SERVICE_URL: z.string().url().default('http://post:8004'),
    // Feed tuning
    FEED_CANDIDATE_POOL: z.string().default('500'),
    FEED_MAX_FOLLOWING_CANDIDATES: z.string().default('300'),
    FEED_MAX_TRENDING_CANDIDATES: z.string().default('50'),
    FEED_MAX_INTEREST_CANDIDATES: z.string().default('150'),
    FEED_TTL_SECONDS: z.string().default('86400'),  // 24h
    FEED_MAX_SIZE: z.string().default('500'),
    INFLUENCER_THRESHOLD: z.string().default('10000'),
    BLOOM_FALSE_POSITIVE: z.string().default('0.01'),
    BLOOM_EXPECTED_ITEMS: z.string().default('10000'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid env vars:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}
const d = parsed.data;

export const config = {
    port: parseInt(d.PORT), nodeEnv: d.NODE_ENV,
    isDev: d.NODE_ENV === 'development', isProd: d.NODE_ENV === 'production',
    logLevel: d.LOG_LEVEL, serviceName: d.SERVICE_NAME,
    mongo: { uri: d.MONGODB_URI },
    redis: { url: d.REDIS_URL, db: parseInt(d.REDIS_DB) },
    jwt: { publicKey: d.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'), issuer: d.JWT_ISSUER, audience: d.JWT_AUDIENCE },
    kafka: { brokers: d.KAFKA_BROKERS.split(',').map((b: string) => b.trim()) },
    services: { userUrl: d.USER_SERVICE_URL, postUrl: d.POST_SERVICE_URL },
    feed: {
        candidatePool: parseInt(d.FEED_CANDIDATE_POOL),
        maxFollowingCandidates: parseInt(d.FEED_MAX_FOLLOWING_CANDIDATES),
        maxTrendingCandidates: parseInt(d.FEED_MAX_TRENDING_CANDIDATES),
        maxInterestCandidates: parseInt(d.FEED_MAX_INTEREST_CANDIDATES),
        ttlSeconds: parseInt(d.FEED_TTL_SECONDS),
        maxSize: parseInt(d.FEED_MAX_SIZE),
        influencerThreshold: parseInt(d.INFLUENCER_THRESHOLD),
    },
    bloom: {
        falsePositiveRate: parseFloat(d.BLOOM_FALSE_POSITIVE),
        expectedItems: parseInt(d.BLOOM_EXPECTED_ITEMS),
    },
} as const;
