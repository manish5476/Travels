import { User } from '../models/user.model';
import { tokenService, TokenPair } from './token.service';
import { firebaseService } from './firebase.service';
import { oauthService } from './oauth.service';
import { publishAuthEvent } from '../utils/kafkaPublisher';
import { logger } from '../utils/logger';

// ── TYPED AUTH ERRORS ────────────────────────────────────────
export class AuthError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status: number
    ) {
        super(message);
        this.name = 'AuthError';
    }
}

const Err = {
    invalidCreds: () => new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401),
    accountLocked: () => new AuthError('Account temporarily locked', 'ACCOUNT_LOCKED', 423),
    accountSuspended: () => new AuthError('Account suspended', 'ACCOUNT_SUSPENDED', 403),
    phoneExists: () => new AuthError('Phone number already registered', 'PHONE_EXISTS', 409),
    emailExists: () => new AuthError('Email already registered', 'EMAIL_EXISTS', 409),
    otpInvalid: () => new AuthError('Invalid or expired OTP', 'OTP_INVALID', 400),
    otpRateLimit: () => new AuthError('Too many OTP requests', 'OTP_RATE_LIMIT', 429),
    googleInvalid: () => new AuthError('Invalid Google token', 'INVALID_GOOGLE_TOKEN', 401),
    firebaseInvalid: () => new AuthError('Invalid or expired Firebase token', 'INVALID_FIREBASE_TOKEN', 401),
    firebaseNotPhone: () => new AuthError('Firebase token must come from phone auth', 'FIREBASE_TOKEN_NOT_PHONE', 400),
    tokenReused: () => new AuthError('Session invalidated. Login again', 'TOKEN_REUSED', 401),
    tokenExpired: () => new AuthError('Session expired. Login again', 'TOKEN_EXPIRED', 401),
    tokenInvalid: () => new AuthError('Invalid session', 'TOKEN_INVALID', 401),
    notFound: () => new AuthError('User not found', 'USER_NOT_FOUND', 404),
};

const MAX_FAILED = 5;
const LOCK_MINS = 15;

export const authService = {

    // ── REGISTER ─────────────────────────────────────────────
    async register(phone: string, password: string, displayName: string) {
        if (await User.findByPhone(phone)) throw Err.phoneExists();

        const user = await User.create({
            phone,
            passwordHash: password,  // pre-save hook bcrypts this
            phoneVerified: false,
            authProviders: [{ provider: 'phone', providerId: phone }],
        });

        await publishAuthEvent('user.registered', {
            userId: user._id.toString(),
            phone,
            displayName,
            registeredAt: new Date().toISOString(),
        });

        const tokens = await tokenService.generatePair(user._id.toString());
        logger.info({ userId: user._id }, 'User registered');
        return { userId: user._id.toString(), tokens };
    },

    // ── LOGIN WITH PASSWORD ───────────────────────────────────
    async loginWithPassword(phone: string, password: string): Promise<TokenPair> {
        const user = await User.findOne({ phone }).select('+passwordHash');
        if (!user) throw Err.invalidCreds();

        if (user.accountStatus === 'suspended' || user.accountStatus === 'banned')
            throw Err.accountSuspended();

        if (user.isLocked()) throw Err.accountLocked();

        const valid = await user.comparePassword(password);
        if (!valid) {
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= MAX_FAILED) {
                user.lockUntil = new Date(Date.now() + LOCK_MINS * 60 * 1000);
                logger.warn({ userId: user._id }, 'Account locked after failed logins');
            }
            await user.save();
            throw Err.invalidCreds();
        }

        // Reset lock on successful login
        if (user.failedLoginAttempts > 0) {
            await User.updateOne({ _id: user._id },
                { failedLoginAttempts: 0, $unset: { lockUntil: 1 } });
        }

        logger.info({ userId: user._id }, 'Login success');
        return tokenService.generatePair(user._id.toString());
    },

    // ── SEND OTP (DEPRECATED — replaced by Firebase Phone Auth) ──
    // async sendOtp(phone: string, ip: string, ua: string): Promise<void> { ... }

    // ── VERIFY OTP (DEPRECATED — replaced by Firebase Phone Auth) ─
    // async verifyOtpAndLogin(phone: string, otp: string) { ... }

    // ── LOGIN WITH FIREBASE PHONE AUTH ────────────────────────
    // Flow:
    //   1. Client performs phone verification entirely via Firebase SDK.
    //   2. Client sends the resulting Firebase idToken to POST /v1/auth/login/firebase.
    //   3. We verify the idToken server-side using firebase-admin.
    //   4. We extract the verified phone number and upsert our own User document.
    //   5. We issue our own RS256 access + refresh tokens (tokenService is unchanged).
    async loginWithFirebase(idToken: string) {
        // ── Verify Firebase token ─────────────────────────────
        let firebasePayload: { phone: string; firebaseUid: string };
        try {
            firebasePayload = await firebaseService.verifyPhoneToken(idToken);
        } catch (err: any) {
            if (err.message === 'FIREBASE_TOKEN_NOT_PHONE') throw Err.firebaseNotPhone();
            // Covers expired, revoked, malformed tokens
            throw Err.firebaseInvalid();
        }

        const { phone, firebaseUid } = firebasePayload;

        // ── Upsert User ───────────────────────────────────────
        let user = await User.findByPhone(phone);
        let isNewUser = false;

        if (!user) {
            // First time this phone number has authenticated — create account
            user = await User.create({
                phone,
                phoneVerified: true,
                authProviders: [{ provider: 'phone', providerId: firebaseUid }],
            });
            await publishAuthEvent('user.registered', {
                userId: user._id.toString(),
                phone,
                registeredAt: new Date().toISOString(),
            });
            isNewUser = true;
            logger.info({ userId: user._id, phone }, 'New user registered via Firebase phone auth');
        } else {
            // Returning user — ensure phone is marked verified
            if (!user.phoneVerified) {
                await User.updateOne({ _id: user._id }, { phoneVerified: true });
            }
            logger.info({ userId: user._id, phone }, 'Existing user logged in via Firebase phone auth');
        }

        // ── Account health check ──────────────────────────────
        if (user.accountStatus !== 'active') throw Err.accountSuspended();

        // ── Issue our own JWT pair ────────────────────────────
        const tokens = await tokenService.generatePair(user._id.toString());
        return { tokens, isNewUser };
    },

    // ── GOOGLE OAUTH ─────────────────────────────────────────
    async loginWithGoogle(idToken: string) {
        let googleUser;
        try {
            googleUser = await oauthService.verifyGoogleToken(idToken);
        } catch { throw Err.googleInvalid(); }

        // Find existing by Google provider ID
        let user = await User.findByProvider('google', googleUser.googleId);
        let isNewUser = false;

        if (!user && googleUser.email) {
            user = await User.findByEmail(googleUser.email);
            if (user) {
                // Link Google to existing email account
                await User.updateOne({ _id: user._id }, {
                    $push: { authProviders: { provider: 'google', providerId: googleUser.googleId } },
                    emailVerified: true,
                });
            }
        }

        if (!user) {
            user = await User.create({
                email: googleUser.email,
                emailVerified: googleUser.emailVerified,
                authProviders: [{ provider: 'google', providerId: googleUser.googleId }],
            });
            await publishAuthEvent('user.registered', {
                userId: user._id.toString(), email: googleUser.email,
                displayName: googleUser.displayName, avatarUrl: googleUser.avatarUrl,
                registeredAt: new Date().toISOString(),
            });
            isNewUser = true;
        }

        if (user.accountStatus !== 'active') throw Err.accountSuspended();

        const tokens = await tokenService.generatePair(user._id.toString());
        return { tokens, isNewUser };
    },

    // ── REFRESH TOKENS ────────────────────────────────────────
    async refreshTokens(refreshToken: string): Promise<TokenPair> {
        try {
            return await tokenService.rotate(refreshToken);
        } catch (err: any) {
            if (err.message === 'REFRESH_TOKEN_REUSED') throw Err.tokenReused();
            if (err.message === 'REFRESH_TOKEN_EXPIRED') throw Err.tokenExpired();
            if (err.message === 'INVALID_REFRESH_TOKEN') throw Err.tokenInvalid();
            throw Err.tokenInvalid();
        }
    },

    // ── LOGOUT ───────────────────────────────────────────────
    async logout(refreshToken: string): Promise<void> {
        await tokenService.revoke(refreshToken);
    },

    async logoutAll(userId: string): Promise<void> {
        await tokenService.revokeAll(userId);
    },

    // ── CHANGE PASSWORD ───────────────────────────────────────
    async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
        const user = await User.findById(userId).select('+passwordHash');
        if (!user) throw Err.notFound();

        const valid = await user.comparePassword(oldPass);
        if (!valid) throw Err.invalidCreds();

        user.passwordHash = newPass; // pre-save re-hashes
        await user.save();
        await tokenService.revokeAll(userId); // Logout all devices
        logger.info({ userId }, 'Password changed, all sessions revoked');
    },
};




// import { User } from '../models/user.model';
// import { tokenService } from './token.service';
// import { otpService } from './otp.service';
// import { oauthService } from './oauth.service';
// import { publishAuthEvent } from '../utils/kafka-publisher';
// import { logger } from '../utils/logger';

// // ── CUSTOM AUTH ERRORS ──────────────────────────────────────
// export class AuthError extends Error {
//     constructor(
//         message: string,
//         public readonly code: string,
//         public readonly statusCode: number
//     ) { super(message); this.name = 'AuthError'; }
// }

// const E = {
//     unauthorized: () => new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401),
//     accountLocked: () => new AuthError('Account is temporarily locked', 'ACCOUNT_LOCKED', 423),
//     accountSuspended: () => new AuthError('Account suspended', 'ACCOUNT_SUSPENDED', 403),
//     phoneExists: () => new AuthError('Phone number already registered', 'PHONE_EXISTS', 409),
//     otpInvalid: () => new AuthError('Invalid or expired OTP', 'OTP_INVALID', 400),
//     otpRateLimit: () => new AuthError('Too many OTP requests. Try again in 1 hour', 'OTP_RATE_LIMIT', 429),
//     invalidGoogle: () => new AuthError('Invalid Google token', 'INVALID_GOOGLE_TOKEN', 401),
//     tokenReused: () => new AuthError('Session invalidated. Please login again', 'TOKEN_REUSED', 401),
//     tokenExpired: () => new AuthError('Session expired. Please login again', 'TOKEN_EXPIRED', 401),
// };

// const MAX_FAILED_ATTEMPTS = 5;
// const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// export const authService = {

//     // ── REGISTER WITH PHONE ──────────────────────────────────
//     async register(phone: string, password: string, displayName: string) {
//         const existing = await User.findByPhone(phone);
//         if (existing) throw E.phoneExists();

//         const user = await User.create({
//             phone,
//             passwordHash: password,   // pre-save hook bcrypts this
//             authProviders: [{ provider: 'phone', providerId: phone }],
//         });

//         // Publish event → User Service creates profile, Notification sends welcome
//         await publishAuthEvent('user.registered', {
//             userId: user._id.toString(),
//             phone,
//             displayName,
//             registeredAt: new Date().toISOString(),
//         });

//         const tokens = await tokenService.generatePair(user._id.toString());
//         logger.info({ userId: user._id }, 'User registered');
//         return { userId: user._id.toString(), tokens };
//     },

//     // ── LOGIN WITH PHONE + PASSWORD ───────────────────────────
//     async loginWithPassword(phone: string, password: string) {
//         // +passwordHash — select: false means we must explicitly request it
//         const user = await User.findOne({ phone }).select('+passwordHash');
//         if (!user) throw E.unauthorized();

//         if (user.accountStatus === 'suspended' || user.accountStatus === 'banned') {
//             throw E.accountSuspended();
//         }

//         if (user.isLocked()) throw E.accountLocked();

//         const isValid = await user.comparePassword(password);
//         if (!isValid) {
//             // Increment failed attempts
//             user.failedLoginAttempts += 1;
//             if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
//                 user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
//                 logger.warn({ userId: user._id, phone }, 'Account locked after failed attempts');
//             }
//             await user.save();
//             throw E.unauthorized();
//         }

//         // Reset failed attempts on successful login
//         if (user.failedLoginAttempts > 0) {
//             user.failedLoginAttempts = 0;
//             user.lockUntil = undefined;
//             await user.save();
//         }

//         const tokens = await tokenService.generatePair(user._id.toString());
//         logger.info({ userId: user._id }, 'User logged in');
//         return tokens;
//     },

//     // ── SEND OTP ─────────────────────────────────────────────
//     async sendOtp(phone: string, ip: string) {
//         try {
//             await otpService.send(phone, 'login', ip);
//         } catch (err: any) {
//             if (err.message === 'OTP_RATE_LIMIT_EXCEEDED') throw E.otpRateLimit();
//             throw err;
//         }
//     },

//     // ── VERIFY OTP + LOGIN ────────────────────────────────────
//     async verifyOtpAndLogin(phone: string, otp: string) {
//         const valid = await otpService.verify(phone, otp);
//         if (!valid) throw E.otpInvalid();

//         // Upsert: create account if doesn't exist, or just login
//         let user = await User.findByPhone(phone);
//         if (!user) {
//             user = await User.create({
//                 phone,
//                 phoneVerified: true,
//                 authProviders: [{ provider: 'phone', providerId: phone }],
//             });
//             await publishAuthEvent('user.registered', {
//                 userId: user._id.toString(), phone, registeredAt: new Date().toISOString(),
//             });
//         } else {
//             await User.updateOne({ _id: user._id }, { phoneVerified: true });
//         }

//         const tokens = await tokenService.generatePair(user._id.toString());
//         const isNewUser = !user.phoneVerified; // false for existing user (stale value used intentionally before updateOne)
//         return { tokens, isNewUser };
//     },

//     // ── GOOGLE OAUTH ──────────────────────────────────────────
//     async loginWithGoogle(idToken: string) {
//         let googleUser;
//         try {
//             googleUser = await oauthService.verifyGoogleToken(idToken);
//         } catch { throw E.invalidGoogle(); }

//         // Find by Google provider ID
//         let user = await User.findOne({
//             'authProviders.provider': 'google',
//             'authProviders.providerId': googleUser.googleId,
//         });

//         let isNewUser = false;

//         if (!user) {
//             // Check if email already linked to another account
//             if (googleUser.email) {
//                 user = await User.findByEmail(googleUser.email);
//             }

//             if (user) {
//                 // Link Google to existing account
//                 await User.updateOne({ _id: user._id }, {
//                     $push: { authProviders: { provider: 'google', providerId: googleUser.googleId } },
//                     emailVerified: true,
//                 });
//             } else {
//                 // Create new account
//                 user = await User.create({
//                     email: googleUser.email,
//                     emailVerified: true,
//                     authProviders: [{ provider: 'google', providerId: googleUser.googleId }],
//                 });
//                 await publishAuthEvent('user.registered', {
//                     userId: user._id.toString(),
//                     email: googleUser.email,
//                     displayName: googleUser.displayName,
//                     avatarUrl: googleUser.avatarUrl,
//                     registeredAt: new Date().toISOString(),
//                 });
//                 isNewUser = true;
//             }
//         }

//         if (user.accountStatus !== 'active') throw E.accountSuspended();

//         const tokens = await tokenService.generatePair(user._id.toString());
//         return { tokens, isNewUser };
//     },

//     // ── REFRESH TOKENS ────────────────────────────────────────
//     async refreshTokens(refreshToken: string) {
//         try {
//             return await tokenService.rotate(refreshToken);
//         } catch (err: any) {
//             if (err.message === 'REFRESH_TOKEN_REUSED') throw E.tokenReused();
//             if (err.message === 'REFRESH_TOKEN_EXPIRED') throw E.tokenExpired();
//             throw E.tokenExpired();
//         }
//     },

//     // ── LOGOUT ───────────────────────────────────────────────
//     async logout(refreshToken: string): Promise<void> {
//         await tokenService.revoke(refreshToken);
//     },

//     // ── LOGOUT ALL DEVICES ────────────────────────────────────
//     async logoutAll(userId: string): Promise<void> {
//         await tokenService.revokeAllForUser(userId);
//         logger.info({ userId }, 'All sessions terminated');
//     },

//     // ── CHANGE PASSWORD ───────────────────────────────────────
//     async changePassword(userId: string, oldPassword: string, newPassword: string) {
//         const user = await User.findById(userId).select('+passwordHash');
//         if (!user) throw E.unauthorized();

//         const valid = await user.comparePassword(oldPassword);
//         if (!valid) throw E.unauthorized();

//         user.passwordHash = newPassword; // pre-save hook re-hashes
//         await user.save();

//         // Revoke all existing sessions — user must log in again on all devices
//         await tokenService.revokeAllForUser(userId);
//         logger.info({ userId }, 'Password changed, all sessions revoked');
//     },
// };