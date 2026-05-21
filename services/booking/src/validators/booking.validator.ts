import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const datesSchema = z.object({
    check_in: z.string().datetime().optional(),
    check_out: z.string().datetime().optional(),
    date: z.string().datetime().optional(),
    duration_hours: z.number().int().min(1).optional(),
}).refine(d => d.check_in || d.date, { message: 'Either check_in+check_out or date required' });

const guestSchema = z.object({
    user_id: z.string().optional(),
    name: z.string().min(1).max(80),
    age: z.number().int().min(0).max(120).optional(),
});

export const createBookingSchema = z.object({
    vendor_id: z.string().min(1),
    catalog_item_id: z.string().min(1),
    dates: datesSchema,
    guests: z.array(guestSchema).min(1).max(50),
    trip_id: z.string().optional(),
});

export const cancelBookingSchema = z.object({
    reason: z.string().max(300).optional(),
});

export const verifyQrSchema = z.object({
    qr_payload: z.string().min(1),
});

export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false, code: 'VALIDATION_ERROR',
                errors: result.error.flatten().fieldErrors
            });
        }
        req.body = result.data;
        next();
    };
}
