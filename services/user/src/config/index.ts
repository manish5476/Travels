import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('8002'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('user-service'),

    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().min(5),
    REDIS_DB: z.string().default('1'),

    // JWT public key — for token verification only (no private key needed here)
    JWT_PUBLIC_KEY: z.string().min(100),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),

    // AWS S3 for avatar storage
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: z.string().min(10),
    AWS_SECRET_ACCESS_KEY: z.string().min(10),
    S3_AVATAR_BUCKET: z.string().min(3),
    CDN_BASE_URL: z.string().url(),

    // Kafka
    KAFKA_BROKERS: z.string().min(5),

    // Internal service URLs (for cross-service calls)
    AUTH_SERVICE_URL: z.string().url().default('http://auth:8001'),

    // Cache TTLs (seconds)
    CACHE_PROFILE_TTL: z.string().default('300'),   // 5 min
    CACHE_FOLLOWERS_TTL: z.string().default('60'),    // 1 min
    CACHE_FOLLOW_COUNT_TTL: z.string().default('120'),  // 2 min
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
}

const d = parsed.data;
export const config = {
    port: parseInt(d.PORT),
    nodeEnv: d.NODE_ENV,
    isDev: d.NODE_ENV === 'development',
    isProd: d.NODE_ENV === 'production',
    logLevel: d.LOG_LEVEL,
    serviceName: d.SERVICE_NAME,
    mongo: { uri: d.MONGODB_URI },
    redis: { url: d.REDIS_URL, db: parseInt(d.REDIS_DB) },
    jwt: {
        publicKey: d.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
        issuer: d.JWT_ISSUER,
        audience: d.JWT_AUDIENCE,
    },
    aws: {
        region: d.AWS_REGION,
        accessKeyId: d.AWS_ACCESS_KEY_ID,
        secretAccessKey: d.AWS_SECRET_ACCESS_KEY,
        s3AvatarBucket: d.S3_AVATAR_BUCKET,
        cdnBaseUrl: d.CDN_BASE_URL,
    },
    kafka: { brokers: d.KAFKA_BROKERS.split(',').map(b => b.trim()) },
    services: { authUrl: d.AUTH_SERVICE_URL },
    cache: {
        profileTtl: parseInt(d.CACHE_PROFILE_TTL),
        followersTtl: parseInt(d.CACHE_FOLLOWERS_TTL),
        followCountTtl: parseInt(d.CACHE_FOLLOW_COUNT_TTL),
    },
} as const;

export type Config = typeof config;
