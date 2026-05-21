import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── Reusable schemas ──────────────────────────────────────────────────────
const coordsSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const catalogItemSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    price: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    unit: z.enum(['per_night', 'per_trip', 'per_person', 'per_hour']),
    max_guests: z.number().int().min(1).max(500).default(10),
    active: z.boolean().default(true),
});

export const createVendorSchema = z.object({
    business_name: z.string().min(2).max(100),
    category: z.enum(['hotel', 'cab', 'tour_guide', 'restaurant', 'activity', 'shop']),
    description: z.string().max(1000).optional(),
    location: z.object({
        coordinates: coordsSchema,
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
    }),
    geofence_radius_km: z.number().min(1).max(50).default(5),
    catalog: z.array(catalogItemSchema).min(0).max(50),
    bank_details_ref: z.string().min(1),
});

export const blockDatesSchema = z.object({
    catalog_item_id: z.string(),
    dates: z.array(z.string().regex(/^d{4}-d{2}-d{2}$/)).min(1).max(365),
    status: z.enum(['blocked', 'available']).default('blocked'),
});

export const reviewSchema = z.object({
    vendor_id: z.string(),
    booking_id: z.string(),
    rating: z.number().int().min(1).max(5),
    text: z.string().max(1000).optional(),
    media_urls: z.array(z.string().url()).max(5).default([]),
});

// ── Validator middleware factory ───────────────────────────────────────────
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
