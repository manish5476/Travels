
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('8008'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('messaging-service'),
    MONGODB_URI: z.string().url(),
    // Two Redis connections: one for data, one for Pub/Sub
    // (Redis Pub/Sub blocks the connection while subscribed)
    REDIS_URL: z.string().min(5),
    REDIS_DB: z.string().default('5'),
    // JWT
    JWT_PUBLIC_KEY: z.string().min(100),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),
    // Kafka
    KAFKA_BROKERS: z.string().min(5),
    // Message limits
    MAX_MESSAGE_LENGTH: z.string().default('4000'),
    MAX_GROUP_SIZE: z.string().default('50'),
    TYPING_TTL_SECONDS: z.string().default('3'),
    PRESENCE_TTL_SECONDS: z.string().default('30'),
    HEARTBEAT_INTERVAL_MS: z.string().default('15000'),
    // CORS origins (comma-separated)
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
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
    limits: {
        maxMessageLength: parseInt(d.MAX_MESSAGE_LENGTH),
        maxGroupSize: parseInt(d.MAX_GROUP_SIZE),
        typingTtl: parseInt(d.TYPING_TTL_SECONDS),
        presenceTtl: parseInt(d.PRESENCE_TTL_SECONDS),
        heartbeatInterval: parseInt(d.HEARTBEAT_INTERVAL_MS),
    },
    corsOrigins: d.CORS_ORIGINS.split(',').map(o => o.trim()),
} as const;
