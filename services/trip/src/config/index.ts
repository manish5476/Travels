
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('8009'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('trip-service'),
    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().min(5),
    REDIS_DB: z.string().default('4'),
    JWT_PUBLIC_KEY: z.string().min(100),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),
    KAFKA_BROKERS: z.string().min(5),
    // Claude API for AI Planner
    ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
    // Internal service URLs
    VENDOR_SERVICE_URL: z.string().url().default('http://vendor:8012'),
    POST_SERVICE_URL: z.string().url().default('http://post:8004'),
    // AI Planner cache TTL
    AI_CACHE_TTL_SECONDS: z.string().default('86400'),
    // App base URL for invite links
    APP_BASE_URL: z.string().url().default('https://tripparty.in'),
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
    anthropic: { apiKey: d.ANTHROPIC_API_KEY },
    services: { vendorUrl: d.VENDOR_SERVICE_URL, postUrl: d.POST_SERVICE_URL },
    aiCacheTtl: parseInt(d.AI_CACHE_TTL_SECONDS),
    appBaseUrl: d.APP_BASE_URL,
} as const;