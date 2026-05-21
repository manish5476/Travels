import { z } from 'zod';
import pino from 'pino';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('8011'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('expense-service'),
    MONGODB_URI: z.string(),
    REDIS_URL: z.string(),
    KAFKA_BROKERS: z.string(),
    JWT_PUBLIC_KEY: z.string(),
    INTERNAL_SERVICE_SECRET: z.string(),
    TRIP_SERVICE_URL: z.string().default('http://trip:8009'),
    PAYMENT_SERVICE_URL: z.string().default('http://payment:8014'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    // Use raw console — logger not yet initialised
    console.error('❌ Invalid env config:');
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
}
export const config = parsed.data;

// ── Pino structured logger (matches Auth Service pattern) ────────────────────
export const logger = pino({
    level: config.LOG_LEVEL,
    redact: ['req.headers.authorization', 'body.password'],
    transport: config.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
