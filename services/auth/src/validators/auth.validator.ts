import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── E.164 PHONE REGEX ─────────────────────────────────────────
// Examples: +919876543210  +14155238886
const e164Phone = z
    .string()
    .regex(/^\+[1-9]\d{9,14}$/, 'Phone must be E.164 format: +CountryCodeNumber');

// ── SCHEMAS ──────────────────────────────────────────────────
const schemas = {

    register: z.object({
        phone: e164Phone,
        password: z.string().min(8).max(72),
        displayName: z.string().min(2).max(60).trim(),
    }),

    loginPhone: z.object({
        phone: e164Phone,
        password: z.string().min(1, 'Password required'),
    }),

    // ── DEPRECATED: OTP schemas (kept for reference only) ──────────────────
    // sendOtp: z.object({ phone: e164Phone }),
    // verifyOtp: z.object({
    //     phone: e164Phone,
    //     otp: z.string().length(6).regex(/^\d{6}$/, 'OTP must be 6 digits'),
    // }),

    // ── Firebase Phone Auth (NEW) ────────────────────────────────
    // The client sends a Firebase ID token obtained after phone verification.
    loginFirebase: z.object({
        idToken: z.string().min(50, 'Invalid Firebase token'),
    }),

    oauthGoogle: z.object({
        idToken: z.string().min(50, 'Invalid Google token'),
    }),

    refresh: z.object({
        refreshToken: z.string().uuid('Invalid refresh token format'),
    }),

    logout: z.object({
        refreshToken: z.string().uuid().optional(),
    }),

    changePassword: z.object({
        oldPassword: z.string().min(1, 'Current password required'),
        newPassword: z.string().min(8, 'Min 8 chars').max(72),
    }).refine(d => d.oldPassword !== d.newPassword, {
        message: 'New password must be different from current password',
        path: ['newPassword'],
    }),
};

export type ValidatorKey = keyof typeof schemas;

// ── MIDDLEWARE FACTORY ────────────────────────────────────────
export function validateBody(key: ValidatorKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schemas[key].safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                errors: result.error.flatten().fieldErrors,
                requestId: req.headers['x-request-id'],
            });
            return;
        }
        req.body = result.data;  // Replace with sanitized data
        next();
    };
}




// import { z } from 'zod';
// import { Request, Response, NextFunction } from 'express';

// // ── ZOD SCHEMAS ─────────────────────────────────────────────
// const schemas = {

//     register: z.object({
//         phone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Must be E.164 format: +91XXXXXXXXXX'),
//         password: z.string().min(8, 'Min 8 chars').max(72, 'Max 72 chars'),
//         displayName: z.string().min(2, 'Min 2 chars').max(60, 'Max 60 chars').trim(),
//     }),

//     loginPhone: z.object({
//         phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
//         password: z.string().min(1, 'Required'),
//     }),

//     sendOtp: z.object({
//         phone: z.string().regex(/^\+[1-9]\d{9,14}$/, 'Must be E.164 format'),
//     }),

//     verifyOtp: z.object({
//         phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
//         otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/),
//     }),

//     oauthGoogle: z.object({
//         idToken: z.string().min(100, 'Invalid token'),
//     }),

//     refresh: z.object({
//         refreshToken: z.string().uuid('Invalid refresh token format'),
//     }),

//     logout: z.object({
//         refreshToken: z.string().uuid().optional(),
//     }),

//     changePassword: z.object({
//         oldPassword: z.string().min(1),
//         newPassword: z.string().min(8).max(72)
//             .refine(p => /[A-Z]/.test(p), 'Must contain uppercase')
//             .refine(p => /[0-9]/.test(p), 'Must contain a number'),
//     }),
// };

// export type SchemaKey = keyof typeof schemas;

// // ── MIDDLEWARE FACTORY ───────────────────────────────────────
// export function validateBody(schemaKey: SchemaKey) {
//     return (req: Request, res: Response, next: NextFunction) => {
//         const result = schemas[schemaKey].safeParse(req.body);
//         if (!result.success) {
//             return res.status(400).json({
//                 success: false,
//                 code: 'VALIDATION_ERROR',
//                 message: 'Invalid request body',
//                 errors: result.error.flatten().fieldErrors,
//                 requestId: req.headers['x-request-id'],
//             });
//         }
//         req.body = result.data; // Replace with validated + coerced data
//         return next();
//     };
// }


