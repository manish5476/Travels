
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const MediaItemSchema = z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    blurHash: z.string().max(30).optional(),
    type: z.enum(['photo', 'video']),
    width: z.number().positive(),
    height: z.number().positive(),
    durationSec: z.number().positive().optional(),
    aspectRatio: z.string().default('1:1'),
});

const LocationSchema = z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([
        z.number().min(-180).max(180),  // lng
        z.number().min(-90).max(90),    // lat
    ]),
});

const schemas = {

    createPost: z.object({
        type: z.enum(['post', 'reel', 'story', 'trip_log']).default('post'),
        media: z.array(MediaItemSchema).min(1).max(10),
        caption: z.string().max(2200).default(''),
        tripId: z.string().length(24).optional(),
        waypointIndex: z.number().int().min(0).optional(),
        location: LocationSchema.optional(),
        locationLabel: z.string().max(200).optional(),
        placeId: z.string().optional(),
        taggedVendors: z.array(z.string().length(24)).max(5).optional(),
        taggedUsers: z.array(z.string().length(24)).max(20).optional(),
        hideLikeCount: z.boolean().default(false),
        commentsDisabled: z.boolean().default(false),
    }),

    updatePost: z.object({
        caption: z.string().max(2200).optional(),
        hideLikeCount: z.boolean().optional(),
        commentsDisabled: z.boolean().optional(),
    }).refine(d => Object.keys(d).length > 0, { message: 'At least one field required' }),

    createComment: z.object({
        text: z.string().min(1).max(1000).trim(),
        parentId: z.string().length(24).optional(),
    }),

    reportPost: z.object({
        reason: z.enum(['spam', 'nudity', 'violence', 'hate_speech', 'harassment', 'false_info', 'scam', 'other']),
        description: z.string().max(500).optional(),
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
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
