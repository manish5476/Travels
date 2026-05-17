
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const schemas = {

    updateProfile: z.object({
        displayName: z.string().min(2).max(60).trim().optional(),
        bio: z.string().max(160).optional(),
        website: z.string().url('Must be a valid URL').max(100).optional().or(z.literal('')),
        preferences: z.object({
            budgetStyle: z.enum(['budget', 'mid', 'luxury']).optional(),
            interests: z.array(z.string().max(30)).max(10).optional(),
            homeCity: z.object({
                type: z.literal('Point'),
                coordinates: z.tuple([z.number(), z.number()]),
                label: z.string().max(100),
            }).nullable().optional(),
        }).optional(),
        privacySettings: z.object({
            locationSharing: z.enum(['off', 'friends', 'public']).optional(),
            profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
            storyAudience: z.enum(['everyone', 'followers', 'close_friends']).optional(),
            showOnlineStatus: z.boolean().optional(),
            showLastSeen: z.boolean().optional(),
        }).optional(),
    }),

    deviceToken: z.object({
        token: z.string().min(10),
        platform: z.enum(['ios', 'android']),
    }),

    usernameParam: z.object({
        username: z.string().regex(/^[a-z0-9_.]{3,30}$/),
    }),

    paginationQuery: z.object({
        cursor: z.string().optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(50)).optional(),
    }),

    searchQuery: z.object({
        q: z.string().min(2).max(50),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(20)).optional(),
    }),

    awardXp: z.object({
        action: z.enum([
            'TRIP_COMPLETED', 'BOOKING_MADE', 'FIVE_STATES_VISITED',
            'LED_THREE_TRIPS', 'TEN_REVIEWS', 'SEVEN_DAY_STREAK',
            'THOUSAND_KM', 'FRIEND_REFERRED',
        ]),
    }),
};

export type ValidatorKey = keyof typeof schemas;

export function validateBody(key: ValidatorKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = (schemas[key] as any).safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false, code: 'VALIDATION_ERROR',
                errors: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

export function validateQuery(key: ValidatorKey) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = (schemas[key] as any).safeParse(req.query);
        if (!result.success) {
            res.status(400).json({
                success: false, code: 'VALIDATION_ERROR',
                errors: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.query = result.data as any;
        next();
    };
}
