import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── Reusable sub-schemas ──────────────────────────────────────────────────────
const splitEntrySchema = z.object({
    user_id: z.string().min(1),
    percentage: z.number().min(0).max(100).optional(),
    amount: z.number().min(0).optional(),
});

const itemSchema = z.object({
    description: z.string().min(1).max(200),
    amount: z.number().positive(),
    assigned_to: z.array(z.string().min(1)).min(1),
});

// ── Add expense schema ────────────────────────────────────────────────────────
export const addExpenseSchema = z.object({
    trip_id: z.string().min(1),
    description: z.string().min(1).max(300),
    amount: z.number().positive(),
    currency: z.string().length(3).default('INR'),
    category: z.enum(['transport', 'accommodation', 'food', 'activities', 'shopping', 'other']).default('other'),
    paid_by: z.string().min(1),
    split_method: z.enum(['equal', 'percentage', 'fixed', 'item']),
    // Conditional fields — validated at service layer
    participant_ids: z.array(z.string()).min(1).max(50).optional(),
    percentage_splits: z.array(splitEntrySchema).min(1).max(50).optional(),
    fixed_splits: z.array(splitEntrySchema).min(1).max(50).optional(),
    items: z.array(itemSchema).min(1).max(100).optional(),
    receipt_url: z.string().url().optional(),
    notes: z.string().max(500).optional(),
});

// ── Initiate settlement schema ────────────────────────────────────────────────
export const settleSchema = z.object({
    trip_id: z.string().min(1),
    to_user_id: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().length(3).default('INR'),
});

// ── Internal confirm settlement schema ────────────────────────────────────────
export const confirmSettlementSchema = z.object({
    settlement_id: z.string().min(1),
    payment_id: z.string().min(1),
});

// ── Validator middleware factory ──────────────────────────────────────────────
export function validate(schema: z.ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                success: false,
                code: 'VALIDATION_ERROR',
                errors: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
