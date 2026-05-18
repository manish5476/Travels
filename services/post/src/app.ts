
import 'express-async-errors';
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { v4 as uuid } from 'uuid';
import { postRoutes } from './routes/post.routes';
import { commentRoutes } from './routes/comment.routes';
import { logger } from './utils/logger';
import { PostError } from './services/post.service';
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

    app.get('/health', (_req, res) => res.json({
        status: 'ok', service: config.serviceName, ts: new Date().toISOString()
    }));

    app.use('/v1/posts', postRoutes);
    app.use('/v1/comments', commentRoutes);

    app.use((req: Request, res: Response) => {
        res.status(404).json({
            success: false, code: 'NOT_FOUND',
            message: `${req.method} ${req.path} not found`
        });
    });

    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof PostError) {
            return res.status(err.status).json({ success: false, code: err.code, message: err.message });
        }
        // Handle string errors thrown from services
        if (err.message === 'POST_NOT_FOUND') return res.status(404).json({ success: false, code: 'POST_NOT_FOUND', message: 'Post not found' });
        if (err.message === 'COMMENT_NOT_FOUND') return res.status(404).json({ success: false, code: 'COMMENT_NOT_FOUND', message: 'Comment not found' });
        if (err.message === 'COMMENTS_DISABLED') return res.status(400).json({ success: false, code: 'COMMENTS_DISABLED', message: 'Comments are disabled on this post' });
        if (err.message === 'FORBIDDEN') return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Not authorized' });
        logger.error({ err, path: req.path }, 'Unhandled error');
        return res.status(500).json({ success: false, code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong' });
    });

    return app;
}
