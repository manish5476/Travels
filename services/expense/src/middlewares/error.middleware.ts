import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../config/index';

export function errorMiddleware(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void {
    const requestId = req.headers['x-request-id'];

    if (err instanceof AppError && err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            code: err.code,
            message: err.message,
            requestId,
        });
        return;
    }

    // Unexpected error — log full stack, never leak internals
    logger.error({ err, requestId }, 'Unhandled error');
    res.status(500).json({
        success: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong',
        requestId,
    });
}
