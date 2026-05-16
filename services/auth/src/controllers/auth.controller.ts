import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';

// Controllers are THIN: extract → call service → respond.
// All try/catch passes to next(err) → global error handler in app.ts.

export const authController = {

    register: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { phone, password, displayName } = req.body;
            const result = await authService.register(phone, password, displayName);
            res.status(201).json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    loginPhone: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { phone, password } = req.body;
            const tokens = await authService.loginWithPassword(phone, password);
            res.json({ success: true, data: tokens });
        } catch (err) { next(err); }
    },

    // ── DEPRECATED: sendOtp — replaced by Firebase Phone Auth ────────────
    // sendOtp: async (req: Request, res: Response, next: NextFunction) => {
    //     const ip = req.ip ?? 'unknown';
    //     const ua = req.headers['user-agent'] ?? 'unknown';
    //     await authService.sendOtp(req.body.phone, ip, ua);
    //     res.json({ success: true, message: 'OTP sent to your phone number' });
    // },

    // ── DEPRECATED: verifyOtp — replaced by Firebase Phone Auth ──────────
    // verifyOtp: async (req: Request, res: Response, next: NextFunction) => {
    //     const result = await authService.verifyOtpAndLogin(req.body.phone, req.body.otp);
    //     res.json({ success: true, data: result });
    // },

    // ── NEW: Login via Firebase Phone Auth ───────────────────────────────
    loginFirebase: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.loginWithFirebase(req.body.idToken);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    oauthGoogle: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await authService.loginWithGoogle(req.body.idToken);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    refresh: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tokens = await authService.refreshTokens(req.body.refreshToken);
            res.json({ success: true, data: tokens });
        } catch (err) { next(err); }
    },

    logout: async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (req.body.refreshToken) await authService.logout(req.body.refreshToken);
            res.json({ success: true, message: 'Logged out successfully' });
        } catch (err) { next(err); }
    },

    logoutAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await authService.logoutAll(req.user!.userId);
            res.json({ success: true, message: 'All sessions terminated' });
        } catch (err) { next(err); }
    },

    changePassword: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { oldPassword, newPassword } = req.body;
            await authService.changePassword(req.user!.userId, oldPassword, newPassword);
            res.json({
                success: true,
                message: 'Password changed. Please login again on all devices.',
            });
        } catch (err) { next(err); }
    },

    // Internal: used by API Gateway or other services to validate tokens
    verify: (req: Request, res: Response) => {
        res.json({ success: true, data: req.user });
    },
};




// import { Request, Response, NextFunction } from 'express';
// import { authService } from '../services/auth.service';

// // Controllers are THIN. They only:
// // 1. Extract validated data from req
// // 2. Call the service
// // 3. Format and return the HTTP response
// // They NEVER contain business logic.

// export const authController = {

//     register: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const { phone, password, displayName } = req.body;
//             const result = await authService.register(phone, password, displayName);
//             res.status(201).json({
//                 success: true,
//                 data: result,
//                 message: 'Account created successfully',
//             });
//         } catch (err) { next(err); }
//     },

//     loginPhone: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const { phone, password } = req.body;
//             const tokens = await authService.loginWithPassword(phone, password);
//             res.json({ success: true, data: tokens });
//         } catch (err) { next(err); }
//     },

//     sendOtp: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const ip = req.ip || req.socket.remoteAddress || 'unknown';
//             await authService.sendOtp(req.body.phone, ip);
//             res.json({ success: true, message: 'OTP sent to your phone number' });
//         } catch (err) { next(err); }
//     },

//     verifyOtp: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const { phone, otp } = req.body;
//             const result = await authService.verifyOtpAndLogin(phone, otp);
//             res.json({ success: true, data: result });
//         } catch (err) { next(err); }
//     },

//     oauthGoogle: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const result = await authService.loginWithGoogle(req.body.idToken);
//             res.json({ success: true, data: result });
//         } catch (err) { next(err); }
//     },

//     refresh: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const tokens = await authService.refreshTokens(req.body.refreshToken);
//             res.json({ success: true, data: tokens });
//         } catch (err) { next(err); }
//     },

//     logout: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             if (req.body.refreshToken) {
//                 await authService.logout(req.body.refreshToken);
//             }
//             res.json({ success: true, message: 'Logged out successfully' });
//         } catch (err) { next(err); }
//     },

//     logoutAll: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             // req.user is attached by authMiddleware
//             await authService.logoutAll(req.user!.userId);
//             res.json({ success: true, message: 'All sessions terminated' });
//         } catch (err) { next(err); }
//     },

//     changePassword: async (req: Request, res: Response, next: NextFunction) => {
//         try {
//             const { oldPassword, newPassword } = req.body;
//             await authService.changePassword(req.user!.userId, oldPassword, newPassword);
//             res.json({ success: true, message: 'Password changed. Please login again on all devices.' });
//         } catch (err) { next(err); }
//     },
// };
