import pino from 'pino';
import { config } from '../config';

export const logger = pino({
    level: config.logLevel,
    base: { service: config.serviceName, env: config.nodeEnv },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ['req.headers.authorization'], censor: '[Redacted]' },
    transport: config.isDev
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
