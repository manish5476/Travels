import mongoose from 'mongoose';
import { ExpenseModel, IExpense, SplitMethod, ExpenseCategory } from '../models/expense.model';
import { SettlementModel } from '../models/settlement.model';
import { getRedis } from '../config/redis';
import { publishEvent } from '../kafka/producer';
import { AppError } from '../errors/AppError';
import { logger } from '../config/index';
import {
    equalSplit, percentageSplit, fixedSplit, itemSplit,
    computeSettlements, SettlementTransaction,
} from './split.service';

// ── Cache key for trip balance summary ───────────────────────────────────────
const balanceCacheKey = (tripId: string) => `expense:balance:${tripId}`;
const CACHE_TTL = 300; // 5 min — invalidated on every write

export const expenseService = {

    // ── Add a new expense ──────────────────────────────────────────────────
    async addExpense(params: {
        trip_id: string;
        description: string;
        amount: number;
        currency?: string;
        category?: ExpenseCategory;
        paid_by: string;
        split_method: SplitMethod;
        // For 'equal': provide participant_ids
        participant_ids?: string[];
        // For 'percentage': provide [{user_id, percentage}]
        percentage_splits?: { user_id: string; percentage: number }[];
        // For 'fixed': provide [{user_id, amount}] + payer gets remainder
        fixed_splits?: { user_id: string; amount: number }[];
        // For 'item': provide items array
        items?: { description: string; amount: number; assigned_to: string[] }[];
        receipt_url?: string;
        notes?: string;
        added_by: string;
    }): Promise<IExpense> {

        const {
            trip_id, description, amount, currency = 'INR', category = 'other',
            paid_by, split_method, participant_ids, percentage_splits,
            fixed_splits, items, receipt_url, notes, added_by,
        } = params;

        // ── Compute splits based on method ─────────────────────────────────
        let splits;
        switch (split_method) {
            case 'equal':
                if (!participant_ids?.length) throw new AppError('participant_ids required for equal split', 400, 'INVALID_SPLIT');
                splits = equalSplit(amount, participant_ids);
                break;

            case 'percentage':
                if (!percentage_splits?.length) throw new AppError('percentage_splits required', 400, 'INVALID_SPLIT');
                splits = percentageSplit(amount, percentage_splits);
                break;

            case 'fixed':
                if (!fixed_splits?.length) throw new AppError('fixed_splits required', 400, 'INVALID_SPLIT');
                splits = fixedSplit(amount, fixed_splits, paid_by);
                break;

            case 'item':
                if (!items?.length) throw new AppError('items required for item split', 400, 'INVALID_SPLIT');
                splits = itemSplit(items);
                break;

            default:
                throw new AppError(`Unknown split method: ${split_method}`, 400, 'INVALID_SPLIT');
        }

        // ── Persist expense ────────────────────────────────────────────────
        const expense = (await ExpenseModel.create({
            trip_id, description, amount, currency, category,
            paid_by, split_method, splits, items, receipt_url, notes, added_by,
        })) as unknown as IExpense;

        // ── Bust balance cache ─────────────────────────────────────────────
        await getRedis().del(balanceCacheKey(trip_id));

        // ── Kafka: expense.added → Notification Service ────────────────────
        // Notification Service sends: 'Rahul added ₹2400 hotel expense'
        await publishEvent('expense.added', expense._id.toString(), {
            expense_id: expense._id,
            trip_id,
            description,
            amount,
            currency,
            category,
            paid_by,
            split_method,
            added_by,
            participant_ids: splits.map(s => s.user_id),
        });

        logger.info({ expense_id: expense._id, trip_id, amount }, 'Expense added');
        return expense;
    },

    // ── Get all expenses for a trip (cursor paginated) ─────────────────
    async getTripExpenses(tripId: string, cursor?: string, limit = 30) {
        const query: any = { trip_id: tripId };
        if (cursor) query.created_at = { $lt: new Date(cursor) };

        const expenses = await ExpenseModel
            .find(query)
            .sort({ created_at: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = expenses.length > limit;
        if (hasMore) expenses.pop();
        const next_cursor = hasMore ? expenses[expenses.length - 1].created_at.toISOString() : null;

        return { expenses, next_cursor };
    },

    // ── Delete an expense ──────────────────────────────────────────────
    async deleteExpense(expenseId: string, userId: string): Promise<void> {
        const expense = await ExpenseModel.findById(expenseId);
        if (!expense) throw new AppError('Expense not found', 404, 'NOT_FOUND');
        // Only the person who added it can delete it
        if (expense.added_by !== userId)
            throw new AppError('Not authorised to delete this expense', 403, 'FORBIDDEN');
        if (expense.is_settled)
            throw new AppError('Cannot delete a settled expense', 400, 'ALREADY_SETTLED');

        await expense.deleteOne();
        await getRedis().del(balanceCacheKey(expense.trip_id));
        logger.info({ expense_id: expenseId }, 'Expense deleted');
    },

    // ── Get balance summary (with Redis cache) ─────────────────────────
    // Returns per-person totals + list of settlements needed
    async getBalanceSummary(tripId: string) {
        const redis = getRedis();
        const cached = await redis.get(balanceCacheKey(tripId));
        if (cached) return JSON.parse(cached);

        const expenses = await ExpenseModel.find({ trip_id: tripId }).lean();

        // ── Per-person paid / owed totals ───────────────────────────────
        const paid = new Map<string, number>();
        const owed = new Map<string, number>();
        let totalSpent = 0;

        for (const exp of expenses) {
            paid.set(exp.paid_by, (paid.get(exp.paid_by) || 0) + exp.amount);
            totalSpent += exp.amount;
            for (const sp of exp.splits) {
                owed.set(sp.user_id, (owed.get(sp.user_id) || 0) + sp.amount);
            }
        }

        // ── Net balance per person ──────────────────────────────────────
        const allUsers = new Set([...paid.keys(), ...owed.keys()]);
        const per_person: Record<string, { paid: number; owed: number; net: number }> = {};
        for (const uid of allUsers) {
            const p = paid.get(uid) || 0;
            const o = owed.get(uid) || 0;
            per_person[uid] = {
                paid: Math.round(p * 100) / 100,
                owed: Math.round(o * 100) / 100,
                net: Math.round((p - o) * 100) / 100, // positive = owed back, negative = owes
            };
        }

        // ── Min-cost flow settlement ────────────────────────────────────
        const unsettledExpenses = expenses.filter(e => !e.is_settled);
        const settlements_needed: SettlementTransaction[] = computeSettlements(unsettledExpenses);

        const summary = {
            trip_id: tripId,
            total_spent: Math.round(totalSpent * 100) / 100,
            expense_count: expenses.length,
            per_person,
            settlements_needed,  // from_user_id owes to_user_id this amount
        };

        await redis.setex(balanceCacheKey(tripId), CACHE_TTL, JSON.stringify(summary));
        return summary;
    },

    // ── Initiate settlement payment (UPI in-app) ────────────────────────
    // Blueprint Section 13.4: Alice taps 'Pay Bob ₹1200' → Razorpay UPI sheet opens
    async initiateSettlement(params: {
        trip_id: string;
        from_user_id: string;
        to_user_id: string;
        amount: number;
        currency?: string;
    }): Promise<ISettlement> {
        const { trip_id, from_user_id, to_user_id, amount, currency = 'INR' } = params;

        if (from_user_id === to_user_id)
            throw new AppError('Cannot settle with yourself', 400, 'INVALID_SETTLEMENT');

        // Verify there's actually a debt (prevent fraudulent settlements)
        const summary = await expenseService.getBalanceSummary(trip_id);
        const isLegitimate = summary.settlements_needed.some(
            (s: SettlementTransaction) =>
                s.from_user_id === from_user_id &&
                s.to_user_id === to_user_id &&
                Math.abs(s.amount - amount) < 1 // allow ₹1 rounding tolerance
        );
        if (!isLegitimate)
            throw new AppError('No matching debt found for this settlement', 400, 'NO_DEBT');

        // Create settlement record
        const settlement = await SettlementModel.create({
            trip_id, from_user_id, to_user_id, amount, currency,
            status: 'pending',
        });

        // NOTE: Actual Razorpay UPI order is created by Payment Service (8014).
        // We publish an event and Payment Service responds with the order.
        await publishEvent('expense.settlement_initiated', settlement._id.toString(), {
            settlement_id: settlement._id,
            trip_id, from_user_id, to_user_id, amount, currency,
        });

        logger.info({ settlement_id: settlement._id, amount }, 'Settlement initiated');
        return settlement;
    },

    // ── Confirm settlement (called by Payment Service webhook consumer) ──
    async confirmSettlement(settlementId: string, paymentId: string): Promise<void> {
        // MongoDB session — settlement confirmation + expense marking must be atomic
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const settlement = await SettlementModel.findById(settlementId).session(session);
            if (!settlement) throw new AppError('Settlement not found', 404, 'NOT_FOUND');
            if (settlement.status === 'completed')
                throw new AppError('Settlement already completed', 409, 'CONFLICT');

            settlement.status = 'completed';
            settlement.payment_id = paymentId;
            settlement.completed_at = new Date();
            await settlement.save({ session });

            // Mark individual expense splits as paid where this person was the debtor
            await ExpenseModel.updateMany(
                { trip_id: settlement.trip_id, 'splits.user_id': settlement.from_user_id, 'splits.paid': false },
                { $set: { 'splits.$[elem].paid': true } },
                { arrayFilters: [{ 'elem.user_id': settlement.from_user_id }], session }
            );

            // Check if all splits on all expenses are now paid → mark expense settled
            const tripExpenses = await ExpenseModel.find(
                { trip_id: settlement.trip_id },
                { splits: 1, is_settled: 1 },
                { session }
            );
            for (const exp of tripExpenses) {
                if (!exp.is_settled && exp.splits.every(s => s.paid)) {
                    await ExpenseModel.updateOne(
                        { _id: exp._id },
                        { $set: { is_settled: true } },
                        { session }
                    );
                }
            }

            await session.commitTransaction();

            // Bust cache AFTER commit
            await getRedis().del(balanceCacheKey(settlement.trip_id));

            // Publish: both Alice and Bob get confirmation push
            await publishEvent('expense.settlement_completed', settlementId, {
                settlement_id: settlementId,
                trip_id: settlement.trip_id,
                from_user_id: settlement.from_user_id,
                to_user_id: settlement.to_user_id,
                amount: settlement.amount,
                payment_id: paymentId,
            });

            logger.info({ settlement_id: settlementId, payment_id: paymentId }, 'Settlement completed');

        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    },

    // ── Get all settlements for a trip ─────────────────────────────────
    async getTripSettlements(tripId: string) {
        return SettlementModel.find({ trip_id: tripId }).sort({ created_at: -1 }).lean();
    },

    // ── Export trip expense summary as structured data (for PDF in frontend) ─
    async getExportData(tripId: string) {
        const [expenses, settlements, summary] = await Promise.all([
            ExpenseModel.find({ trip_id: tripId }).sort({ created_at: 1 }).lean(),
            SettlementModel.find({ trip_id: tripId, status: 'completed' }).lean(),
            expenseService.getBalanceSummary(tripId),
        ]);

        // Group expenses by category for the summary breakdown
        const by_category: Record<string, number> = {};
        for (const exp of expenses) {
            by_category[exp.category] = (by_category[exp.category] || 0) + exp.amount;
        }

        return {
            trip_id: tripId,
            summary,
            by_category,
            expenses,
            completed_settlements: settlements,
        };
    },
};

// Re-export ISettlement type
import type { ISettlement } from '../models/settlement.model';

