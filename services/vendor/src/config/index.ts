import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.string().default('8012'),
    MONGO_URI: z.string(),
    REDIS_URL: z.string(),
    KAFKA_BROKERS: z.string(),
    SERVICE_NAME: z.string().default('vendor-service'),
    JWT_PUBLIC_KEY: z.string(),
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_S3_BUCKET: z.string(),
    DIGILOCKER_API_KEY: z.string().optional(),
    INTERNAL_SERVICE_SECRET: z.string(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid env config:', parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
