
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../validators/auth.validator';
import { loginRateLimit } from '../middlewares/loginRateLimit';
import { authMiddleware } from '../middlewares/auth.middleware';

export const authRoutes = Router();

// ── PUBLIC ───────────────────────────────────────────────────
authRoutes.post('/register',
    validateBody('register'),
    authController.register
);

authRoutes.post('/login/phone',
    loginRateLimit,
    validateBody('loginPhone'),
    authController.loginPhone
);

// ── DEPRECATED: Twilio/Redis OTP routes (replaced by Firebase Phone Auth) ──
// authRoutes.post('/otp/send',
//     validateBody('sendOtp'),
//     authController.sendOtp
// );
//
// authRoutes.post('/otp/verify',
//     validateBody('verifyOtp'),
//     authController.verifyOtp
// );

// ── Firebase Phone Auth (NEW) ────────────────────────────────
// Client completes phone verification via Firebase SDK, then sends
// the resulting idToken here. We verify it server-side and issue
// our own RS256 JWT pair.
authRoutes.post('/login/firebase',
    loginRateLimit,
    validateBody('loginFirebase'),
    authController.loginFirebase
);

authRoutes.post('/oauth/google',
    validateBody('oauthGoogle'),
    authController.oauthGoogle
);

authRoutes.post('/token/refresh',
    validateBody('refresh'),
    authController.refresh
);

authRoutes.post('/logout',
    validateBody('logout'),
    authController.logout
);

// ── PROTECTED (JWT required) ──────────────────────────────────
authRoutes.post('/logout/all',
    authMiddleware,
    authController.logoutAll
);

authRoutes.post('/password/change',
    authMiddleware,
    validateBody('changePassword'),
    authController.changePassword
);

// ── INTERNAL ─────────────────────────────────────────────────
// Called by API Gateway or other microservices (not exposed to internet)
authRoutes.get('/verify',
    authMiddleware,
    authController.verify
);




// import { Router } from 'express';
// import { authController } from '../controllers/auth.controller';
// import { validateBody } from '../validators/auth.validator';
// import { loginRateLimit } from '../middlewares/loginRateLimit';
// import { authMiddleware } from '../middlewares/authMiddleware';
// export const authRoutes = Router();

// // ── PUBLIC ROUTES (no auth required) ────────────────────────
// authRoutes.post('/register',
//     validateBody('register'),
//     authController.register
// );

// authRoutes.post('/login/phone',
//     loginRateLimit,               // IP-based rate limit: 5/15min
//     validateBody('loginPhone'),
//     authController.loginPhone
// );

// authRoutes.post('/otp/send',
//     validateBody('sendOtp'),
//     authController.sendOtp
// );

// authRoutes.post('/otp/verify',
//     validateBody('verifyOtp'),
//     authController.verifyOtp
// );

// authRoutes.post('/oauth/google',
//     validateBody('oauthGoogle'),
//     authController.oauthGoogle
// );

// authRoutes.post('/token/refresh',
//     validateBody('refresh'),
//     authController.refresh
// );

// authRoutes.post('/logout',
//     validateBody('logout'),
//     authController.logout
// );

// // ── PROTECTED ROUTES (JWT required) ─────────────────────────
// authRoutes.post('/logout/all',
//     authMiddleware,               // Verifies JWT
//     authController.logoutAll
// );

// authRoutes.post('/password/change',
//     authMiddleware,
//     validateBody('changePassword'),
//     authController.changePassword
// );

// // ── INTERNAL (called by other services, not API Gateway) ─────
// authRoutes.get('/verify',
//     authMiddleware,
//     (req, res) => res.json({ success: true, data: req.user })
// );
