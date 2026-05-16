import { v4 as uuid } from 'uuid';
import { RefreshToken } from '../models/refreshToken.model';
import { createAccessToken } from '../utils/token';
import { logger } from '../utils/logger';

// How long a refresh token lives in MS (must match JWT_REFRESH_TTL)
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;  // seconds until access token expires
}

export const tokenService = {

    // ── GENERATE PAIR ───────────────────────────────────────
    // Call this on: register, login, verifyOtp, oauth login
    async generatePair(
        userId: string,
        deviceId: string = 'default',
        family: string = uuid()       // New family = new login session
    ): Promise<TokenPair> {

        const accessToken = createAccessToken(userId, deviceId);
        const refreshToken = uuid();   // Random UUID stored in DB
        const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

        await RefreshToken.create({
            token: refreshToken,
            userId,
            deviceId,
            family,
            expiresAt,
        });

        logger.info({ userId, deviceId }, 'Token pair generated');
        return { accessToken, refreshToken, expiresIn: 900 }; // 15 min
    },

    // ── ROTATE REFRESH TOKEN ─────────────────────────────────
    // Call this in the /token/refresh endpoint.
    // Implements refresh token rotation: old token revoked, new pair issued.
    // Reuse detection: if old token is already revoked, revoke entire family.
    async rotate(oldRefreshToken: string): Promise<TokenPair> {
        const record = await RefreshToken.findOne({ token: oldRefreshToken });

        if (!record) {
            throw new Error('INVALID_REFRESH_TOKEN');
        }

        // ⚠️  REUSE DETECTED
        // Token was already revoked = someone is using a stolen token.
        // Revoke the ENTIRE family → forces re-login on all devices.
        if (record.revoked) {
            logger.warn({
                userId: record.userId.toString(),
                family: record.family,
            }, '🚨 Refresh token reuse detected — revoking entire family');

            await RefreshToken.updateMany(
                { family: record.family },
                { revoked: true }
            );
            throw new Error('REFRESH_TOKEN_REUSED');
        }

        // Expired?
        if (record.expiresAt < new Date()) {
            await RefreshToken.updateOne({ _id: record._id }, { revoked: true });
            throw new Error('REFRESH_TOKEN_EXPIRED');
        }

        // Revoke the old token (rotation)
        await RefreshToken.updateOne({ _id: record._id }, { revoked: true });

        // Issue new pair — same family continues the rotation chain
        return this.generatePair(
            record.userId.toString(),
            record.deviceId,
            record.family   // Same family!
        );
    },

    // ── REVOKE ONE ────────────────────────────────────────────
    async revoke(refreshToken: string): Promise<void> {
        await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });
    },

    // ── REVOKE ALL FOR USER ───────────────────────────────────
    // Use after: password change, account suspend, force logout
    async revokeAll(userId: string): Promise<void> {
        const result = await RefreshToken.updateMany(
            { userId, revoked: false },
            { revoked: true }
        );
        logger.info({ userId, count: result.modifiedCount }, 'All tokens revoked');
    },

    // ── CLEAN UP OLD TOKENS FOR DEVICE ───────────────────────
    // Optional: keep only latest token per deviceId
    async cleanupDevice(userId: string, deviceId: string): Promise<void> {
        const tokens = await RefreshToken.find(
            { userId, deviceId, revoked: false },
            null,
            { sort: { createdAt: -1 } }
        );
        if (tokens.length > 1) {
            const toRevoke = tokens.slice(1).map(t => t._id);
            await RefreshToken.updateMany({ _id: { $in: toRevoke } }, { revoked: true });
        }
    },
};



// import jwt, { SignOptions } from 'jsonwebtoken';
// import { v4 as uuid } from 'uuid';
// import { RefreshToken } from '../models/refreshToken.model';
// import { config } from '../config';
// import { logger } from '../utils/logger';

// export interface TokenPayload {
//     userId: string;
//     deviceId: string;
//     type: 'access';
// }

// export interface TokenPair {
//     accessToken: string;
//     refreshToken: string;
//     expiresIn: number;  // seconds
// }

// // How long refresh tokens last in milliseconds
// const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// export const tokenService = {

//     // ── GENERATE PAIR ──────────────────────────────────────────
//     async generatePair(
//         userId: string,
//         deviceId: string = 'default',
//         family: string = uuid()  // New family for new logins
//     ): Promise<TokenPair> {

//         // Access token — short-lived, RS256 signed, verified by all services
//         const accessPayload: TokenPayload = { userId, deviceId, type: 'access' };
//         const accessToken = jwt.sign(
//             accessPayload,
//             config.jwt.privateKey,
//             {
//                 algorithm: 'RS256',
//                 expiresIn: config.jwt.accessTtl,
//                 issuer: 'tripparty.auth',
//                 audience: 'tripparty.api',
//             } as SignOptions
//         );

//         // Refresh token — long-lived, UUID stored in DB
//         const refreshToken = uuid();
//         const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

//         await RefreshToken.create({ token: refreshToken, userId, deviceId, family, expiresAt });

//         logger.info({ userId, deviceId }, 'Token pair generated');
//         return { accessToken, refreshToken, expiresIn: 900 }; // 15 min
//     },

//     // ── ROTATE REFRESH TOKEN ───────────────────────────────────
//     async rotate(oldRefreshToken: string): Promise<TokenPair> {
//         const record = await RefreshToken.findOne({ token: oldRefreshToken });

//         if (!record) {
//             throw new Error('INVALID_REFRESH_TOKEN');
//         }

//         // REUSE DETECTION: If already revoked → someone is using a stolen token
//         // Revoke the ENTIRE family (all devices for this user logged out)
//         if (record.revoked) {
//             logger.warn({ userId: record.userId, family: record.family }, '🚨 Refresh token reuse detected');
//             await RefreshToken.updateMany({ family: record.family }, { revoked: true });
//             throw new Error('REFRESH_TOKEN_REUSED');
//         }

//         // Expired?
//         if (record.expiresAt < new Date()) {
//             throw new Error('REFRESH_TOKEN_EXPIRED');
//         }

//         // Revoke old token
//         await RefreshToken.updateOne({ _id: record._id }, { revoked: true });

//         // Issue new pair (same family — continues the rotation chain)
//         return this.generatePair(record.userId.toString(), record.deviceId, record.family);
//     },

//     // ── REVOKE ────────────────────────────────────────────────
//     async revoke(refreshToken: string): Promise<void> {
//         await RefreshToken.updateOne({ token: refreshToken }, { revoked: true });
//     },

//     async revokeAllForUser(userId: string): Promise<void> {
//         await RefreshToken.updateMany({ userId }, { revoked: true });
//         logger.info({ userId }, 'All tokens revoked for user');
//     },

//     // ── VERIFY ACCESS TOKEN ────────────────────────────────────
//     verifyAccessToken(token: string): TokenPayload {
//         return jwt.verify(token, config.jwt.publicKey, {
//             algorithms: ['RS256'],
//             issuer: 'tripparty.auth',
//             audience: 'tripparty.api',
//         }) as TokenPayload;
//     },
// };
