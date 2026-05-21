/**
 * split.service.ts
 *
 * Pure computation — no DB calls, no side effects.
 * Blueprint Section 13.3: four split methods + min-cost flow settlement.
 *
 * The min-cost flow algorithm guarantees:
 *   → At most (n - 1) transactions to fully settle n people
 *   → The naive approach can produce O(n²) transactions
 */

import { IExpenseItem } from '../models/expense.model';
import { AppError } from '../errors/AppError';

// ── Result type returned by all split calculators ────────────────────────────
export interface ComputedSplit {
    user_id: string;
    amount: number;   // rounded to 2 decimal places
    paid: boolean;
}

// ── 1. EQUAL SPLIT ────────────────────────────────────────────────────────────
// Blueprint: ₹2,400 ÷ 4 = ₹600 each.
// Odd penny always goes to first payer (index 0).
export function equalSplit(amount: number, userIds: string[]): ComputedSplit[] {
    if (userIds.length === 0) throw new AppError('Split must have at least 1 participant', 400, 'INVALID_SPLIT');

    const base = Math.floor((amount * 100) / userIds.length);     // integer paise
    const total = base * userIds.length;
    const penny = Math.round(amount * 100) - total;                // leftover paise

    return userIds.map((uid, i) => ({
        user_id: uid,
        amount: (base + (i === 0 ? penny : 0)) / 100,              // paise → rupees
        paid: false,
    }));
}

// ── 2. PERCENTAGE SPLIT ───────────────────────────────────────────────────────
// Blueprint: 60% Rahul, 40% Priya. Must sum to 100.
export function percentageSplit(
    amount: number,
    entries: { user_id: string; percentage: number }[]
): ComputedSplit[] {
    const totalPct = entries.reduce((s, e) => s + e.percentage, 0);
    if (Math.abs(totalPct - 100) > 0.01)
        throw new AppError(`Percentages must sum to 100, got ${totalPct}`, 400, 'INVALID_SPLIT');

    const splits = entries.map(e => ({
        user_id: e.user_id,
        amount: Math.round(amount * (e.percentage / 100) * 100) / 100,
        paid: false,
    }));

    // Correct rounding drift — assign remainder to first entry
    const computed = splits.reduce((s, e) => s + e.amount, 0);
    const drift = Math.round((amount - computed) * 100) / 100;
    if (drift !== 0) splits[0].amount = Math.round((splits[0].amount + drift) * 100) / 100;

    return splits;
}

// ── 3. FIXED AMOUNT SPLIT ─────────────────────────────────────────────────────
// Blueprint: named amounts per person, remainder to payer.
export function fixedSplit(
    amount: number,
    entries: { user_id: string; amount: number }[],
    payerId: string
): ComputedSplit[] {
    const assignedTotal = entries.reduce((s, e) => s + e.amount, 0);
    if (assignedTotal > amount + 0.01)
        throw new AppError(`Fixed amounts (${assignedTotal}) exceed total (${amount})`, 400, 'INVALID_SPLIT');

    const remainder = Math.round((amount - assignedTotal) * 100) / 100;

    // Build splits; add remainder to payer's entry
    const map = new Map<string, number>();
    for (const e of entries) map.set(e.user_id, (map.get(e.user_id) || 0) + e.amount);
    map.set(payerId, (map.get(payerId) || 0) + remainder);

    return Array.from(map.entries()).map(([uid, amt]) => ({
        user_id: uid,
        amount: Math.round(amt * 100) / 100,
        paid: false,
    }));
}

// ── 4. ITEM SPLIT ─────────────────────────────────────────────────────────────
// Blueprint: each item assigned to specific people (restaurant bill).
// Example: Pizza → Rahul+Priya. Beer → everyone.
export function itemSplit(items: IExpenseItem[]): ComputedSplit[] {
    if (!items || items.length === 0)
        throw new AppError('Item split requires at least one item', 400, 'INVALID_SPLIT');

    const map = new Map<string, number>();

    for (const item of items) {
        if (!item.assigned_to || item.assigned_to.length === 0)
            throw new AppError(`Item "${item.description}" has no assignees`, 400, 'INVALID_SPLIT');

        const perPerson = item.amount / item.assigned_to.length;
        for (const uid of item.assigned_to) {
            map.set(uid, (map.get(uid) || 0) + perPerson);
        }
    }

    return Array.from(map.entries()).map(([uid, amt]) => ({
        user_id: uid,
        amount: Math.round(amt * 100) / 100,
        paid: false,
    }));
}

// ── MIN-COST FLOW SETTLEMENT ALGORITHM ───────────────────────────────────────
/**
 * Given a list of expenses, compute the minimum set of transactions
 * needed to fully settle all debts.
 *
 * Algorithm:
 *   1. Build net balance per person: balance[uid] = what they paid − what they owe
 *   2. Positive balance → creditor (owed money)
 *   3. Negative balance → debtor (owes money)
 *   4. Greedily match largest debtor with largest creditor
 *   5. This produces at most (n-1) transactions — mathematically optimal
 *
 * Complexity: O(n log n) — sorts the debtors/creditors lists
 */
export interface SettlementTransaction {
    from_user_id: string;
    to_user_id: string;
    amount: number;
}

export function computeSettlements(
    expenses: Array<{ paid_by: string; splits: Array<{ user_id: string; amount: number }> }>
): SettlementTransaction[] {
    // Step 1: compute net balance for each participant
    const balance = new Map<string, number>();

    for (const expense of expenses) {
        // Payer gains credit equal to total amount paid
        const paidAmount = expense.splits.reduce((s, sp) => s + sp.amount, 0);
        balance.set(expense.paid_by,
            (balance.get(expense.paid_by) || 0) + paidAmount
        );

        // Each split participant owes their share
        for (const split of expense.splits) {
            balance.set(split.user_id,
                (balance.get(split.user_id) || 0) - split.amount
            );
        }
    }

    // Step 2: separate into creditors (positive) and debtors (negative)
    const creditors: { uid: string; amount: number }[] = [];
    const debtors: { uid: string; amount: number }[] = [];

    for (const [uid, bal] of balance.entries()) {
        const rounded = Math.round(bal * 100) / 100;
        if (rounded > 0.01) creditors.push({ uid, amount: rounded });
        if (rounded < -0.01) debtors.push({ uid, amount: -rounded }); // store as positive
    }

    // Step 3: sort descending — greedily match largest amounts first
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Step 4: min-cost flow matching
    const transactions: SettlementTransaction[] = [];
    let ci = 0, di = 0;

    while (ci < creditors.length && di < debtors.length) {
        const creditor = creditors[ci];
        const debtor = debtors[di];
        const amount = Math.round(Math.min(creditor.amount, debtor.amount) * 100) / 100;

        transactions.push({ from_user_id: debtor.uid, to_user_id: creditor.uid, amount });

        creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;
        debtor.amount = Math.round((debtor.amount - amount) * 100) / 100;

        if (creditor.amount < 0.01) ci++;
        if (debtor.amount < 0.01) di++;
    }

    return transactions;
}
