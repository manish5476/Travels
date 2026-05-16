import 'express-async-errors';    // Must be FIRST import
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { authRoutes } from './routes/auth.routes';
import { logger } from './utils/logger';
import { AuthError } from './services/auth.service';
import { config } from './config';

export function createApp(): Application {
    const app = express();

    // ── TRUST PROXY ───────────────────────────────────────────
    // Required for correct IP behind AWS ALB / Nginx
    app.set('trust proxy', 1);

    // ── SECURITY HEADERS ──────────────────────────────────────
    app.use(helmet());

    // ── REQUEST ID ────────────────────────────────────────────
    app.use((req: Request, _res: Response, next: NextFunction) => {
        if (!req.headers['x-request-id']) {
            req.headers['x-request-id'] = uuid();
        }
        next();
    });

    // ── HTTP LOGGING ──────────────────────────────────────────
    app.use(pinoHttp({
        logger,
        customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
        redact: ['req.headers.authorization', 'req.body.password', 'req.body.otp'],
    }));

    // ── BODY PARSER ───────────────────────────────────────────
    app.use(express.json({ limit: '10kb' }));

    // ── HEALTH CHECK ──────────────────────────────────────────
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: config.serviceName, ts: new Date().toISOString() });
    });

    // ── ROUTES ───────────────────────────────────────────────
    app.use('/v1/auth', authRoutes);

    // ── 404 ──────────────────────────────────────────────────
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            success: false, code: 'NOT_FOUND',
            message: `${req.method} ${req.path} not found`,
            requestId: req.headers['x-request-id'],
        });
    });

    // ── GLOBAL ERROR HANDLER (MUST BE LAST) ───────────────────
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        const requestId = req.headers['x-request-id'];

        if (err instanceof AuthError) {
            return res.status(err.status).json({
                success: false, code: err.code,
                message: err.message, requestId,
            });
        }

        logger.error({ err, requestId, path: req.path }, 'Unhandled error');
        return res.status(500).json({
            success: false, code: 'INTERNAL_SERVER_ERROR',
            message: 'Something went wrong. Please try again.', requestId,
        });
    });

    return app;
}




// import 'express-async-errors';  // Must be first import — patches async error handling
// import express, { Application, Request, Response, NextFunction } from 'express';
// import helmet from 'helmet';
// import { v4 as uuid } from 'uuid';
// import pinoHttp from 'pino-http';
// import { authRoutes } from './routes/auth.routes';
// import { logger } from './utils/logger';
// import { AuthError } from './services/auth.service';

// export function createApp(): Application {
//     const app = express();

//     // ── SECURITY HEADERS ──────────────────────────────────────
//     app.use(helmet());
//     app.use(helmet.contentSecurityPolicy({
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: ["'self'"],
//         },
//     }));

//     // ── REQUEST ID INJECTION ──────────────────────────────────
//     app.use((req: Request, _res: Response, next: NextFunction) => {
//         req.headers['x-request-id'] = req.headers['x-request-id'] || uuid();
//         next();
//     });

//     // ── HTTP REQUEST LOGGING ──────────────────────────────────
//     app.use(pinoHttp({
//         logger,
//         customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
//         redact: ['req.headers.authorization'],
//     }));

//     // ── BODY PARSERS ──────────────────────────────────────────
//     app.use(express.json({ limit: '10kb' }));       // Prevent huge payload attacks
//     app.use(express.urlencoded({ extended: true, limit: '10kb' }));

//     // ── TRUST PROXY (for correct IP behind AWS ALB) ───────────
//     app.set('trust proxy', 1);

//     // ── HEALTH CHECK ──────────────────────────────────────────
//     app.get('/health', (_req, res) => {
//         res.json({ status: 'ok', service: 'auth', timestamp: new Date().toISOString() });
//     });

//     // ── ROUTES ───────────────────────────────────────────────
//     app.use('/v1/auth', authRoutes);

//     // ── 404 HANDLER ───────────────────────────────────────────
//     app.use((req: Request, res: Response) => {
//         res.status(404).json({
//             success: false,
//             code: 'NOT_FOUND',
//             message: `Route ${req.method} ${req.path} not found`,
//             requestId: req.headers['x-request-id'],
//         });
//     });

//     // ── GLOBAL ERROR HANDLER (must be LAST) ───────────────────
//     app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
//         const requestId = req.headers['x-request-id'];

//         // Our own operational errors (expected: wrong password, not found, etc.)
//         if (err instanceof AuthError) {
//             return res.status(err.statusCode).json({
//                 success: false,
//                 code: err.code,
//                 message: err.message,
//                 requestId,
//             });
//         }

//         // Unexpected errors (bugs) — log full stack, return generic 500
//         logger.error({ err, requestId, path: req.path }, 'Unhandled error');
//         return res.status(500).json({
//             success: false,
//             code: 'INTERNAL_SERVER_ERROR',
//             message: 'Something went wrong. Please try again.',
//             requestId,
//         });
//     });

//     return app;
// }
