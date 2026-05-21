import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('8013'),
    MONGO_URI: z.string(),
    REDIS_URL: z.string(),
    KAFKA_BROKERS: z.string(),
    SERVICE_NAME: z.string().default('booking-service'),
    JWT_PUBLIC_KEY: z.string(),
    RAZORPAY_KEY_ID: z.string(),
    RAZORPAY_KEY_SECRET: z.string(),
    RAZORPAY_WEBHOOK_SECRET: z.string(),
    VENDOR_SERVICE_URL: z.string().default('http://vendor:8012'),
    INTERNAL_SERVICE_SECRET: z.string(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid env config:', parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
