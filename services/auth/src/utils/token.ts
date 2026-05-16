import {
    signAccessToken,
    verifyAccessToken,
    decodeToken,
    AccessTokenPayload,
} from '../config/jwt';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

// Re-export types so consumers don't need to import from config/jwt
export type { AccessTokenPayload };

// ── ERROR TYPES ──────────────────────────────────────────────
export class TokenExpiredAppError extends Error {
    readonly code = 'TOKEN_EXPIRED';
    readonly statusCode = 401;
    constructor() { super('Access token has expired'); }
}

export class TokenInvalidAppError extends Error {
    readonly code = 'TOKEN_INVALID';
    readonly statusCode = 401;
    constructor(reason?: string) {
        super(reason ? `Invalid token: ${reason}` : 'Invalid token');
    }
}

// ── SIGN ─────────────────────────────────────────────────────
// Creates a signed JWT access token.
// Payload: { userId, deviceId } → adds type:'access', iat, exp, iss, aud automatically.
export function createAccessToken(userId: string, deviceId = 'default'): string {
    return signAccessToken({ userId, deviceId });
}

// ── VERIFY (with typed errors) ────────────────────────────────
// Call this in middleware. Throws TokenExpiredAppError or TokenInvalidAppError.
// Never returns null — always throws on failure.
export function validateAccessToken(token: string): AccessTokenPayload {
    try {
        return verifyAccessToken(token);
    } catch (err) {
        if (err instanceof TokenExpiredError) {
            throw new TokenExpiredAppError();
        }
        if (err instanceof JsonWebTokenError) {
            throw new TokenInvalidAppError(err.message);
        }
        throw new TokenInvalidAppError();
    }
}
// ── SAFE DECODE (no verification) ────────────────────────────
// Use ONLY for logging/debugging, never for authorization.
export function safeDecodeToken(token: string): AccessTokenPayload | null {
    try {
        return decodeToken(token);
    } catch {
        return null;
    }
}

// ── EXTRACT FROM HEADER ───────────────────────────────────────
// Parses 'Bearer <token>' header. Returns token string or null.
export function extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    return token.length > 0 ? token : null;
}
