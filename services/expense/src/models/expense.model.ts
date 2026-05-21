import mongoose, { Schema, Document } from 'mongoose';

// ── Split method types (mirrors blueprint Section 13.3) ──────────────────────
export type SplitMethod = 'equal' | 'percentage' | 'fixed' | 'item';
export type ExpenseCategory = 'transport' | 'accommodation' | 'food' |
    'activities' | 'shopping' | 'other';

export interface ISplitEntry {
    user_id: string;
    amount: number;   // exact amount this user owes (computed)
    percentage?: number;  // for 'percentage' method
    paid: boolean;  // has this person settled this split
}

export interface IExpenseItem {
    description: string;
    amount: number;
    assigned_to: string[]; // user_ids who share this item
}

export interface IExpense extends Document {
    trip_id: string;
    description: string;
    amount: number;
    currency: string;
    category: ExpenseCategory;
    paid_by: string;   // user_id of who paid
    split_method: SplitMethod;
    splits: ISplitEntry[];
    items?: IExpenseItem[];  // for 'item' split method
    receipt_url?: string;
    notes?: string;
    added_by: string;   // user_id (may differ from paid_by)
    is_settled: boolean;  // true once ALL splits are settled
    created_at: Date;
    updated_at: Date;
}

const SplitEntrySchema = new Schema<ISplitEntry>({
    user_id: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    paid: { type: Boolean, default: false },
}, { _id: false });

const ExpenseItemSchema = new Schema<IExpenseItem>({
    description: { type: String, required: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    assigned_to: [{ type: String }],
}, { _id: false });

const ExpenseSchema = new Schema<IExpense>({
    trip_id: { type: String, required: true, index: true },
    description: { type: String, required: true, maxlength: 300 },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'INR' },
    category: {
        type: String,
        enum: ['transport', 'accommodation', 'food', 'activities', 'shopping', 'other'],
        default: 'other',
    },
    paid_by: { type: String, required: true },
    split_method: { type: String, enum: ['equal', 'percentage', 'fixed', 'item'], required: true },
    splits: { type: [SplitEntrySchema], required: true },
    items: [ExpenseItemSchema],
    receipt_url: String,
    notes: { type: String, maxlength: 500 },
    added_by: { type: String, required: true },
    is_settled: { type: Boolean, default: false, index: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Compound indexes for common query patterns
ExpenseSchema.index({ trip_id: 1, created_at: -1 });
ExpenseSchema.index({ trip_id: 1, is_settled: 1 });
ExpenseSchema.index({ 'splits.user_id': 1, 'splits.paid': 1 });

export const ExpenseModel = mongoose.model<IExpense>('Expense', ExpenseSchema);
