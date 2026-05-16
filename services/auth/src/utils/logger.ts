import pino from 'pino';
import { config } from '../config';

export const logger = pino({
    level: config.logLevel,

    // Add service name and env to every log line
    base: {
        service: config.serviceName,
        env: config.nodeEnv,
        pid: process.pid,
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive fields — they will show as '[Redacted]' in logs
    // This applies even if accidentally logged deep in an object
    redact: {
        paths: [
            'password',
            'passwordHash',
            '*.passwordHash',
            'token',
            'refreshToken',
            'accessToken',
            'otp',
            'idToken',
            'req.headers.authorization',
            'req.body.password',
            'req.body.otp',
        ],
        censor: '[Redacted]',
    },

    // Pretty print in dev, raw JSON in prod (→ CloudWatch / Loki)
    transport: config.nodeEnv !== 'production' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
        },
    }
        : undefined,
});

// Convenience child logger factory
// Usage: const log = childLogger('token.service');
export function childLogger(name: string) {
    return logger.child({ module: name });
}
