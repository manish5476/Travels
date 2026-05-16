import * as admin from 'firebase-admin';
import { logger } from '../utils/logger';

// ── FIREBASE ADMIN INITIALIZATION ────────────────────────────
// The SDK is initialized once as a singleton on first import.
// We support two strategies via environment variables:
//
//   Strategy A (Recommended for production):
//     FIREBASE_SERVICE_ACCOUNT_BASE64 — a base64-encoded JSON service account key.
//     Generate: base64 -i serviceAccount.json | tr -d '\n'
//
//   Strategy B (Local dev with Application Default Credentials):
//     GOOGLE_APPLICATION_CREDENTIALS — path to the service account JSON file.
//     The SDK picks this up automatically if Strategy A is not set.

function initFirebaseAdmin(): admin.app.App {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (base64Key) {
        // Strategy A: decode and parse the service account from the env var
        try {
            const json = Buffer.from(base64Key, 'base64').toString('utf-8');
            const serviceAccount = JSON.parse(json) as admin.ServiceAccount;

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });

            logger.info('✅ Firebase Admin initialized via FIREBASE_SERVICE_ACCOUNT_BASE64');
        } catch (err) {
            logger.fatal({ err }, '❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64 — check encoding');
            process.exit(1);
        }
    } else {
        // Strategy B: rely on GOOGLE_APPLICATION_CREDENTIALS or local emulator
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
        logger.info('✅ Firebase Admin initialized via Application Default Credentials');
    }

    return admin.apps[0]!;
}

// Eagerly initialize so failures surface at startup, not first request
const firebaseApp = initFirebaseAdmin();
const auth = admin.auth(firebaseApp);

// ── FIREBASE SERVICE ─────────────────────────────────────────
export interface FirebasePhonePayload {
    /** E.164 phone number verified by Firebase, e.g. +919876543210 */
    phone: string;
    /** Firebase UID — stored for potential cross-referencing */
    firebaseUid: string;
}

export const firebaseService = {

    /**
     * Verifies a Firebase ID token issued after phone number authentication.
     * Returns the verified phone number and Firebase UID.
     *
     * @throws {AuthError} with code INVALID_FIREBASE_TOKEN if token is bad/expired.
     */
    async verifyPhoneToken(idToken: string): Promise<FirebasePhonePayload> {
        // checkRevoked: true — ensures the token hasn't been revoked server-side
        const decoded = await auth.verifyIdToken(idToken, true);

        if (!decoded.phone_number) {
            // This should only happen if the client sent a token from a
            // non-phone auth provider (e.g. Google Sign-In). Reject it here —
            // Google OAuth has its own dedicated endpoint.
            throw new Error('FIREBASE_TOKEN_NOT_PHONE');
        }

        return {
            phone: decoded.phone_number,
            firebaseUid: decoded.uid,
        };
    },
};
