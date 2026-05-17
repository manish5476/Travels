
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
    // ── Server ─────────────────────────────────────────────
    PORT: z.string().default('8001'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    SERVICE_NAME: z.string().default('auth-service'),

    // ── MongoDB ─────────────────────────────────────────────
    MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),

    // ── Redis ───────────────────────────────────────────────
    REDIS_URL: z.string().min(5, 'REDIS_URL is required'),
    REDIS_DB: z.string().default('0'),

    // ── JWT (RSA key pair in PEM format) ────────────────────
    // Generate: openssl genrsa -out private.pem 2048
    //           openssl rsa -in private.pem -pubout -out public.pem
    JWT_PRIVATE_KEY: z.string().min(100, 'JWT_PRIVATE_KEY required (RSA PEM)'),
    JWT_PUBLIC_KEY: z.string().min(100, 'JWT_PUBLIC_KEY required (RSA PEM)'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),
    JWT_ISSUER: z.string().default('tripparty.auth'),
    JWT_AUDIENCE: z.string().default('tripparty.api'),

    // ── Firebase Admin (Phone Auth gateway) ──────────────────────
    // Optional: base64-encoded service account JSON.
    // If not set, falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC.
    FIREBASE_SERVICE_ACCOUNT_BASE64: z.string().optional(),

    // ── Google OAuth ────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().min(10),
    GOOGLE_CLIENT_SECRET: z.string().min(5),

    // ── Kafka ───────────────────────────────────────────────
    KAFKA_BROKERS: z.string().min(5),

    // ── Rate Limiting ───────────────────────────────────────
    LOGIN_RATE_LIMIT_WINDOW_MS: z.string().default('900000'),  // 15 min
    LOGIN_RATE_LIMIT_MAX: z.string().default('5'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('\n❌  INVALID ENVIRONMENT VARIABLES:');
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    console.error('\nFix the above errors in your .env file and restart.\n');
    process.exit(1);
}

export const config = {
    port: parseInt(parsed.data.PORT),
    nodeEnv: parsed.data.NODE_ENV,
    isDev: parsed.data.NODE_ENV === 'development',
    isProd: parsed.data.NODE_ENV === 'production',
    logLevel: parsed.data.LOG_LEVEL,
    serviceName: parsed.data.SERVICE_NAME,

    mongo: {
        uri: parsed.data.MONGODB_URI,
    },

    redis: {
        url: parsed.data.REDIS_URL,
        db: parseInt(parsed.data.REDIS_DB),
    },

    jwt: {
        // Replace escaped newlines from env var format
        privateKey: parsed.data.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        publicKey: parsed.data.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
        accessTtl: parsed.data.JWT_ACCESS_TTL,
        refreshTtl: parsed.data.JWT_REFRESH_TTL,
        issuer: parsed.data.JWT_ISSUER,
        audience: parsed.data.JWT_AUDIENCE,
    },

    firebase: {
        serviceAccountBase64: parsed.data.FIREBASE_SERVICE_ACCOUNT_BASE64,
    },

    google: {
        clientId: parsed.data.GOOGLE_CLIENT_ID,
        clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
    },

    kafka: {
        brokers: parsed.data.KAFKA_BROKERS.split(',').map(b => b.trim()),
    },

    rateLimit: {
        windowMs: parseInt(parsed.data.LOGIN_RATE_LIMIT_WINDOW_MS),
        max: parseInt(parsed.data.LOGIN_RATE_LIMIT_MAX),
    },
} as const;

export type Config = typeof config;

// import { z } from 'zod';

// const envSchema = z.object({
//     PORT: z.string().default('8001'),
//     NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
//     LOG_LEVEL: z.string().default('info'),
//     SERVICE_NAME: z.string().default('auth-service'),

//     // MongoDB
//     MONGODB_URI: z.string().min(10),

//     // Redis
//     REDIS_URL: z.string().min(5),
//     REDIS_DB: z.string().default('0'),

//     // JWT — RSA key pair (PEM format)
//     JWT_PRIVATE_KEY: z.string().min(100),
//     JWT_PUBLIC_KEY: z.string().min(100),
//     JWT_ACCESS_TTL: z.string().default('15m'),
//     JWT_REFRESH_TTL: z.string().default('30d'),

//     // Twilio OTP
//     TWILIO_ACCOUNT_SID: z.string().startsWith('AC'),
//     TWILIO_AUTH_TOKEN: z.string().min(10),
//     TWILIO_PHONE_NUMBER: z.string().startsWith('+'),

//     // Google OAuth
//     GOOGLE_CLIENT_ID: z.string().min(10),
//     GOOGLE_CLIENT_SECRET: z.string().min(5),

//     // Kafka
//     KAFKA_BROKERS: z.string().min(5),

//     // Rate limiting
//     LOGIN_RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
//     LOGIN_RATE_LIMIT_MAX: z.string().default('5'),
// });

// const parsed = envSchema.safeParse(process.env);

// if (!parsed.success) {
//     console.error('❌ Invalid environment variables:');
//     console.error(parsed.error.flatten().fieldErrors);
//     process.exit(1);  // Hard crash — do not start with bad config
// }

// export const config = {
//     port: parseInt(parsed.data.PORT), nodeEnv: parsed.data.NODE_ENV,
//     logLevel: parsed.data.LOG_LEVEL,
//     serviceName: parsed.data.SERVICE_NAME,
//     mongoUri: parsed.data.MONGODB_URI,
//     redisUrl: parsed.data.REDIS_URL,
//     redisDb: parseInt(parsed.data.REDIS_DB),
//     jwt: {
//         privateKey: parsed.data.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
//         publicKey: parsed.data.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
//         accessTtl: parsed.data.JWT_ACCESS_TTL,
//         refreshTtl: parsed.data.JWT_REFRESH_TTL,
//     },
//     twilio: {
//         accountSid: parsed.data.TWILIO_ACCOUNT_SID,
//         authToken: parsed.data.TWILIO_AUTH_TOKEN,
//         phoneNumber: parsed.data.TWILIO_PHONE_NUMBER,
//     },
//     google: {
//         clientId: parsed.data.GOOGLE_CLIENT_ID,
//         clientSecret: parsed.data.GOOGLE_CLIENT_SECRET,
//     },
//     kafka: {
//         brokers: parsed.data.KAFKA_BROKERS.split(','),
//     },
//     rateLimit: {
//         windowMs: parseInt(parsed.data.LOGIN_RATE_LIMIT_WINDOW_MS),
//         max: parseInt(parsed.data.LOGIN_RATE_LIMIT_MAX),
//     },
// } as const;

// export type Config = typeof config;
