
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const GeoPoint = z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
    label: z.string().min(1).max(200),
    placeId: z.string().optional(),
});

const schemas = {

    createTrip: z.object({
        title: z.string().min(3).max(80).trim(),
        description: z.string().max(500).optional(),
        origin: GeoPoint.nullable().optional(),
        destination: GeoPoint.nullable().optional(),
        dates: z.object({
            start: z.string().datetime(),
            end: z.string().datetime(),
            timezone: z.string().default('Asia/Kolkata'),
        }).optional(),
        budget: z.object({
            estimated: z.number().min(0).default(0),
            currency: z.string().default('INR'),
            perPerson: z.number().min(0).default(0),
        }).optional(),
        visibility: z.enum(['private', 'friends_only', 'public']).default('private'),
        tags: z.array(z.string().max(30).toLowerCase()).max(10).optional(),
        maxCollaborators: z.number().min(2).max(50).default(20),
    }),

    updateTrip: z.object({
        title: z.string().min(3).max(80).trim().optional(),
        description: z.string().max(500).optional(),
        dates: z.object({ start: z.string().datetime(), end: z.string().datetime() }).optional(),
        budget: z.object({ estimated: z.number(), currency: z.string(), perPerson: z.number() }).optional(),
        visibility: z.enum(['private', 'friends_only', 'public']).optional(),
        tags: z.array(z.string()).max(10).optional(),
        coverMediaUrl: z.string().url().optional(),
    }),

    addWaypoint: z.object({
        location: z.object({
            type: z.literal('Point'),
            coordinates: z.tuple([z.number(), z.number()]),
        }),
        label: z.string().min(1).max(200),
        travelMode: z.enum(['flight', 'train', 'car', 'boat', 'walk', 'bus', 'bicycle']).default('car'),
        estimatedArrival: z.string().datetime().optional(),
        notes: z.string().max(500).optional(),
    }),

    invite: z.object({
        userId: z.string().length(24),
        role: z.enum(['co-admin', 'member', 'viewer']).default('member'),
    }),

    addPackingItem: z.object({
        item: z.string().min(1).max(200).trim(),
        category: z.string().max(50).default('general'),
        assignedTo: z.string().length(24).optional(),
    }),

    sosContacts: z.object({
        contacts: z.array(z.object({
            name: z.string().min(1).max(100),
            phone: z.string().regex(/^\+[1-9]\d{9,14}$/),
        })).max(5),
    }),

    vote: z.object({
        dayIndex: z.number().int().min(0),
        itemIndex: z.number().int().min(0),
        vote: z.enum(['up', 'down']),
    }),
};

export type ValidatorKey = keyof typeof schemas;

export function validateBody(key: ValidatorKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = (schemas[key] as any).safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false, code: 'VALIDATION_ERROR',
                errors: result.error.flatten().fieldErrors
            }); return;
        }
        req.body = result.data; next();
    };
}

