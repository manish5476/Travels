
import { z } from 'zod';

const envSchema = z.object({
    PORT: z.string().default('8004'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('post-service'),
    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().min(5),
    REDIS_DB: z.string().default('2'),
    // Elasticsearch
    ELASTICSEARCH_URL: z.string().url().default('http://localhost:9200'),
    ELASTICSEARCH_USERNAME: z.string().default(''),
    ELASTICSEARCH_PASSWORD: z.string().default(''),
    // JWT
    JWT_PUBLIC_KEY: z.string().min(100),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),
    // AWS Rekognition for content moderation
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_ACCESS_KEY_ID: z.string().min(10),
    AWS_SECRET_ACCESS_KEY: z.string().min(10),
    // Kafka
    KAFKA_BROKERS: z.string().min(5),
    // Internal service URLs
    USER_SERVICE_URL: z.string().url().default('http://user:8002'),
    // Moderation thresholds
    NSFW_THRESHOLD: z.string().default('0.85'),
    REPORT_AUTO_FLAG: z.string().default('3'),
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
    elasticsearch: {
        url: d.ELASTICSEARCH_URL,
        username: d.ELASTICSEARCH_USERNAME,
        password: d.ELASTICSEARCH_PASSWORD,
    },
    jwt: {
        publicKey: d.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
        issuer: d.JWT_ISSUER,
        audience: d.JWT_AUDIENCE,
    },
    aws: { region: d.AWS_REGION, accessKeyId: d.AWS_ACCESS_KEY_ID, secretAccessKey: d.AWS_SECRET_ACCESS_KEY },
    kafka: { brokers: d.KAFKA_BROKERS.split(',').map(b => b.trim()) },
    services: { userUrl: d.USER_SERVICE_URL },
    moderation: {
        nsfwThreshold: parseFloat(d.NSFW_THRESHOLD),
        reportAutoFlag: parseInt(d.REPORT_AUTO_FLAG),
    },
} as const;
