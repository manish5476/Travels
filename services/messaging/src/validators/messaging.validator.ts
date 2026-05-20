
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const schemas = {
    createConversation: z.discriminatedUnion('type', [
        z.object({
            type: z.literal('direct'),
            participantId: z.string().length(24),
        }),
        z.object({
            type: z.literal('group'),
            name: z.string().min(1).max(100).trim(),
            participantIds: z.array(z.string().length(24)).min(1).max(49),
        }),
    ]),
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
