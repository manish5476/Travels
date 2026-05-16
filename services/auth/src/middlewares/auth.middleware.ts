import { Request, Response, NextFunction } from 'express';
import {
    validateAccessToken,
    extractBearerToken,
    AccessTokenPayload,
    TokenExpiredAppError,
    TokenInvalidAppError,
} from '../utils/token';
import { redis } from '../config/redis';

// Augment Express request type
declare global {
    namespace Express {
        interface Request {
            user?: AccessTokenPayload;
        }
    }
}

// ── REQUIRED AUTH ─────────────────────────────────────────────
// Returns 401 if no valid JWT present.
// Attaches decoded payload to req.user.
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
        res.status(401).json({
            success: false, code: 'UNAUTHORIZED',
            message: 'Authorization header missing or malformed',
        });
        return;
    }

    try {
        const payload = validateAccessToken(token);  // Throws on invalid/expired

        // Check revocation cache (set by logoutAll / password change)
        const isRevoked = await redis.exists(`revoked:user:${payload.userId}`);
        if (isRevoked) {
            res.status(401).json({
                success: false, code: 'TOKEN_REVOKED',
                message: 'Session has been invalidated. Please login again.',
            });
            return;
        }

        req.user = payload;
        next();

    } catch (err) {
        if (err instanceof TokenExpiredAppError) {
            res.status(401).json({ success: false, code: err.code, message: err.message });
            return;
        }
        if (err instanceof TokenInvalidAppError) {
            res.status(401).json({ success: false, code: err.code, message: err.message });
            return;
        }
        next(err);
    }
}

// ── OPTIONAL AUTH ─────────────────────────────────────────────
// Does NOT return 401 if no token. Attaches user if valid token present.
// Use for routes that work both logged-in and anonymous.
export async function optionalAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
        try {
            req.user = validateAccessToken(token);
        } catch { /* silently ignore */ }
    }
    next();
}






// import { Request, Response, NextFunction } from 'express';
// import { tokenService } from '../services/token.service';
// import { redis } from '../config/redis';

// declare global {
//     namespace Express {
//         interface Request {
//             user?: { userId: string; deviceId: string; type: string };
//         }
//     }
// }

// export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
//     const header = req.headers.authorization;
//     if (!header?.startsWith('Bearer ')) {
//         return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing token' });
//     }

//     const token = header.slice(7);

//     try {
//         const payload = tokenService.verifyAccessToken(token);

//         // Check revocation list (for logout / password change scenarios)
//         const isRevoked = await redis.exists(`revoked:${payload.userId}`);
//         if (isRevoked) {
//             return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Session invalidated' });
//         }

//         req.user = payload;
//         return next();
//     } catch (err: any) {
//         const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
//         return res.status(401).json({ success: false, code, message: 'Invalid or expired token' });
//     }
// }
