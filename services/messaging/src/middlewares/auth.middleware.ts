
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser { userId: string; deviceId: string; }
declare global { namespace Express { interface Request { user?: AuthUser } } }

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, code: 'UNAUTHORIZED' }); return;
    }
    try {
        req.user = jwt.verify(header.slice(7), config.jwt.publicKey, {
            algorithms: ['RS256'], issuer: config.jwt.issuer, audience: config.jwt.audience,
        }) as AuthUser;
        next();
    } catch (err: any) {
        res.status(401).json({ success: false, code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' });
    }
}
