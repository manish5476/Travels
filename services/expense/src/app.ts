import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import 'express-async-errors';
import { logger } from './config/index';
import { errorMiddleware } from './middlewares/error.middleware';
import expenseRoutes from './routes/expense.routes';

export function createApp(): express.Application {
    const app = express();

    // ── Security ──────────────────────────────────────────────────────────
    app.use(helmet());
    app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
    app.use(express.json({ limit: '1mb' }));

    // ── Pino HTTP logger (matches Auth Service pattern) ───────────────────
    app.use(pinoHttp({
        logger,
        customLogLevel: (_req, res) => res.statusCode >= 500 ? 'error' : 'info',
        redact: ['req.headers.authorization'],
        // Add request ID to every log
        genReqId: req => (req.headers['x-request-id'] as string) || require('crypto').randomUUID(),
    }));

    // ── Health check (Kubernetes readiness probe) ─────────────────────────
    app.get('/health', (_req, res) => res.json({
        status: 'ok', service: 'expense-service', ts: new Date().toISOString(),
    }));

    // ── Routes ────────────────────────────────────────────────────────────
    app.use('/v1/expenses', expenseRoutes);

    // ── Error handler (must be LAST) ──────────────────────────────────────
    app.use(errorMiddleware);

    return app;
}
