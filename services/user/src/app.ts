
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { userRoutes } from './routes/user.routes';
import { followRoutes } from './routes/follow.routes';
import { logger } from './utils/logger';
import { UserError } from './services/user.service';
import { config } from './config';

export function createApp(): Application {
    const app = express();
    app.set('trust proxy', 1);
    app.use(helmet());

    // Request ID injection
    app.use((req: Request, _res: Response, next: NextFunction) => {
        if (!req.headers['x-request-id']) req.headers['x-request-id'] = uuid();
        next();
    });

    app.use(pinoHttp({ logger, redact: ['req.headers.authorization'] }));
    app.use(express.json({ limit: '10kb' }));

    app.get('/health', (_req, res) => res.json({
        status: 'ok', service: config.serviceName, ts: new Date().toISOString()
    }));

    // ── ROUTES ──────────────────────────────────────────────
    app.use('/v1/users', userRoutes);
    // Follow routes mounted under /v1/users/:id/
    app.use('/v1/users/:id', followRoutes);

    // 404
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            success: false, code: 'NOT_FOUND',
            message: `${req.method} ${req.path} not found`
        });
    });

    // Global error handler
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof UserError) {
            return res.status(err.status).json({
                success: false, code: err.code, message: err.message,
                requestId: req.headers['x-request-id'],
            });
        }
        logger.error({ err, path: req.path }, 'Unhandled error');
        return res.status(500).json({
            success: false, code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong'
        });
    });

    return app;
}
