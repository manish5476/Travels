import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { config } from './index';
import { logger } from '../utils/logger';

// ── VALIDATE KEYS ON MODULE LOAD ────────────────────────────
// This catches missing/malformed keys at startup, not at first request
function validateKeys(): void {
    try {
        // Test sign with private key
        const testToken = jwt.sign({ test: true }, config.jwt.privateKey, {
            algorithm: 'RS256',
        });
        // Test verify with public key
        jwt.verify(testToken, config.jwt.publicKey, { algorithms: ['RS256'] });
        logger.info('✅ JWT RSA key pair validated successfully');
    } catch (err) {
        logger.fatal({ err },
            '❌ JWT key validation failed. Check JWT_PRIVATE_KEY and JWT_PUBLIC_KEY in .env');
        process.exit(1);
    }
}

validateKeys();

// ── TYPED PAYLOAD ───────────────────────────────────────────
export interface AccessTokenPayload {
    userId: string;
    deviceId: string;
    type: 'access';
    iat?: number;
    exp?: number;
    iss?: string;
    aud?: string | string[];
}

// ── SIGN OPTIONS (for access tokens) ────────────────────────
export const accessTokenSignOptions: SignOptions = {
    algorithm: 'RS256',
    expiresIn: config.jwt.accessTtl as any,   // '15m'
    issuer: config.jwt.issuer,       // 'tripparty.auth'
    audience: config.jwt.audience,     // 'tripparty.api'
};

// ── VERIFY OPTIONS (used by all services) ───────────────────
export const accessTokenVerifyOptions: VerifyOptions = {
    algorithms: ['RS256'], issuer: config.jwt.issuer,
    audience: config.jwt.audience,
};

// ── SIGN ACCESS TOKEN ────────────────────────────────────────
export function signAccessToken(payload: Omit<AccessTokenPayload, 'type' | 'iat' | 'exp' | 'iss' | 'aud'>): string {
    return jwt.sign(
        { ...payload, type: 'access' },
        config.jwt.privateKey,
        accessTokenSignOptions,
    );
}

// ── VERIFY ACCESS TOKEN ──────────────────────────────────────
// Returns the payload or throws JsonWebTokenError / TokenExpiredError
export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(
        token,
        config.jwt.publicKey,
        accessTokenVerifyOptions,
    ) as AccessTokenPayload;
}

// ── DECODE WITHOUT VERIFY (for logging only — never use for auth!) ──
export function decodeToken(token: string): AccessTokenPayload | null {
    return jwt.decode(token) as AccessTokenPayload | null;
}

// ── EXPORTS ─────────────────────────────────────────────────
export const jwtConfig = {
    privateKey: config.jwt.privateKey,
    publicKey: config.jwt.publicKey,
    accessTtl: config.jwt.accessTtl,
    refreshTtl: config.jwt.refreshTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    signAccessToken,
    verifyAccessToken,
    decodeToken,
} as const;

