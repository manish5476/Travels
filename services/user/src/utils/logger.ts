import pino from 'pino';
import { config } from '../config';

export const logger = pino({
    level: config.logLevel,
    base: { service: config.serviceName, env: config.nodeEnv, pid: process.pid },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: ['req.headers.authorization', 'phone', 'email', '*.phone', '*.email'],
        censor: '[Redacted]',
    },
    transport: config.isDev
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
        : undefined,
});
