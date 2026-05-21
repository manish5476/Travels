import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { config } from '../config/index';

export interface AuthUser {
    userId: string;
    deviceId: string;
    roles: string[];
}

declare global {
    namespace Express { interface Request { user?: AuthUser } }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

    const token = header.slice(7);
    try {
        const decoded = jwt.verify(token, config.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
        req.user = decoded as AuthUser;
        next();
    } catch {
        throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }
}

// Called on internal service-to-service routes (Booking → Vendor, Payment → Expense)
export function internalServiceMiddleware(req: Request, res: Response, next: NextFunction): void {
    const secret = req.headers['x-internal-secret'];
    if (!secret || secret !== config.INTERNAL_SERVICE_SECRET) {
        res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Internal access only' });
        return;
    }
    next();
}
