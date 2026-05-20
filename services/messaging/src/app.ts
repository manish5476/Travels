
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { messagingRoutes } from './routes/messaging.routes';
import { logger } from './utils/logger';
import { config } from './config';

export function createApp(): Application {
    const app = express();
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        if (!req.headers['x-request-id']) req.headers['x-request-id'] = uuid();
        next();
    });
    app.use(pinoHttp({ logger, redact: ['req.headers.authorization'] }));
    app.use(express.json({ limit: '10kb' }));
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: config.serviceName, ts: new Date().toISOString() }));
    app.use('/v1/messages', messagingRoutes);
    app.use((req: Request, res: Response) => {
        res.status(404).json({ success: false, code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` });
    });
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        const codeMap: Record<string, number> = {
            CONVERSATION_NOT_FOUND: 404, MESSAGE_NOT_FOUND: 404,
            NOT_A_PARTICIPANT: 403, FORBIDDEN: 403,
            DELETE_WINDOW_EXPIRED: 400,
        };
        if (codeMap[err.message]) {
            return res.status(codeMap[err.message]).json({ success: false, code: err.message });
        }
        logger.error({ err, path: req.path }, 'Unhandled error');
        return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' });
    });
    return app;
}
