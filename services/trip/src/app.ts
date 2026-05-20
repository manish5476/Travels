
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet'; import pinoHttp from 'pino-http'; import { v4 as uuid } from 'uuid';
import { tripRoutes } from './routes/trip.routes';
import { logger } from './utils/logger';
import { TripError } from './services/trip.service';
import { StateMachineError } from './stateMachine/trip.stateMachine';
import { config } from './config';

export function createApp(): Application {
    const app = express();
    app.set('trust proxy', 1); app.use(helmet());
    app.use((req: Request, _res: Response, next: NextFunction) => {
        if (!req.headers['x-request-id']) req.headers['x-request-id'] = uuid(); next();
    });
    app.use(pinoHttp({ logger, redact: ['req.headers.authorization'] }));
    app.use(express.json({ limit: '10kb' }));
    app.get('/health', (_req, res) => res.json({ status: 'ok', service: config.serviceName, ts: new Date().toISOString() }));
    app.use('/v1/trips', tripRoutes);
    app.use((req: Request, res: Response) => {
        res.status(404).json({ success: false, code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` });
    });
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof TripError || err instanceof StateMachineError) {
            return res.status((err as any).status).json({ success: false, code: (err as any).code, message: err.message });
        }
        const code = err.message;
        const statusMap: Record<string, number> = { TRIP_NOT_FOUND: 404, FORBIDDEN: 403, NOT_A_COLLABORATOR: 403 };
        if (statusMap[code]) return res.status(statusMap[code]).json({ success: false, code, message: code.replace(/_/g, ' ') });
        logger.error({ err, path: req.path }, 'Unhandled error');
        return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' });
    });
    return app;
}
