import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import { logger } from '../utils/logger';

const googleClient = new OAuth2Client(config.google.clientId);





export interface OAuthGoogleUser {
    googleId: string;
    email?: string;
    displayName: string;
    avatarUrl?: string;
    emailVerified: boolean;
}

export const oauthService = {

    // ── GOOGLE ────────────────────────────────────────────────
    async verifyGoogleToken(idToken: string): Promise<OAuthGoogleUser> {
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: config.google.clientId,
            });

            const payload = ticket.getPayload();
            if (!payload?.sub) throw new Error('Missing sub in Google payload');

            return {
                googleId: payload.sub,
                email: payload.email,
                displayName: payload.name ?? payload.email?.split('@')[0] ?? 'User',
                avatarUrl: payload.picture,
                emailVerified: payload.email_verified ?? false,
            };
        } catch (err) {
            logger.warn({ err }, 'Google token verification failed');
            throw new Error('INVALID_GOOGLE_TOKEN');
        }
    },
};

// import { OAuth2Client } from 'google-auth-library';
// import { config } from '../config';
// import { logger } from '../utils/logger';

// const googleClient = new OAuth2Client(config.google.clientId);

// export interface GoogleUserInfo {
//     googleId: string;
//     email?: string;
//     displayName: string;
//     avatarUrl?: string;
// }

// export const oauthService = {

//     // ── GOOGLE ──────────────────────────────────────────────────
//     async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
//         try {
//             const ticket = await googleClient.verifyIdToken({
//                 idToken,
//                 audience: config.google.clientId,
//             });

//             const payload = ticket.getPayload();
//             if (!payload || !payload.sub) {
//                 throw new Error('Invalid Google token payload');
//             }

//             return {
//                 googleId: payload.sub,
//                 email: payload.email,
//                 displayName: payload.name || payload.email?.split('@')[0] || 'User',
//                 avatarUrl: payload.picture,
//             };
//         } catch (err) {
//             logger.error({ err }, 'Google token verification failed');
//             throw new Error('INVALID_GOOGLE_TOKEN');
//         }
//     },

//     // ── APPLE (JWT-based, verify with Apple's public key) ───────
//     // Simplified: In production use 'apple-signin-auth' package
//     async verifyAppleToken(_identityToken: string): Promise<{ appleId: string; email?: string }> {
//         // 1. Decode JWT header to get key ID (kid)
//         // 2. Fetch Apple's public keys from https://appleid.apple.com/auth/keys
//         // 3. Verify JWT signature with matching key
//         // 4. Validate iss = 'https://appleid.apple.com', aud = your bundle ID
//         // This is implemented via: npm install apple-signin-auth
//         throw new Error('APPLE_OAUTH_NOT_IMPLEMENTED'); // Replace with full impl
//     },
// };