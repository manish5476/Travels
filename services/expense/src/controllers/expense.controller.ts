import 'express-async-errors'; // eliminates try/catch in every handler
import { Request, Response } from 'express';
import { expenseService } from '../services/expense.service';

export const expenseController = {

    // POST /v1/expenses
    async addExpense(req: Request, res: Response): Promise<void> {
        const expense = await expenseService.addExpense({
            ...req.body,
            added_by: req.user!.userId,
        });
        res.status(201).json({ success: true, data: expense });
    },

    // GET /v1/expenses/trip/:tripId
    async getTripExpenses(req: Request, res: Response): Promise<void> {
        const { cursor, limit } = req.query as any;
        const result = await expenseService.getTripExpenses(
            req.params.tripId as string, cursor as string | undefined, limit ? parseInt(limit) : 30
        );
        res.json({ success: true, ...result });
    },

    // DELETE /v1/expenses/:id
    async deleteExpense(req: Request, res: Response): Promise<void> {
        await expenseService.deleteExpense(req.params.id as string, req.user!.userId);
        res.json({ success: true, message: 'Expense deleted' });
    },

    // GET /v1/expenses/trip/:tripId/summary
    async getBalanceSummary(req: Request, res: Response): Promise<void> {
        const summary = await expenseService.getBalanceSummary(req.params.tripId as string);
        res.json({ success: true, data: summary });
    },

    // POST /v1/expenses/settle
    async initiateSettlement(req: Request, res: Response): Promise<void> {
        const settlement = await expenseService.initiateSettlement({
            ...req.body,
            from_user_id: req.user!.userId, // always the logged-in user
        });
        res.status(201).json({ success: true, data: settlement });
    },

    // GET /v1/expenses/trip/:tripId/settlements
    async getTripSettlements(req: Request, res: Response): Promise<void> {
        const settlements = await expenseService.getTripSettlements(req.params.tripId as string);
        res.json({ success: true, data: settlements });
    },

    // GET /v1/expenses/trip/:tripId/export
    async getExportData(req: Request, res: Response): Promise<void> {
        const data = await expenseService.getExportData(req.params.tripId as string);
        res.json({ success: true, data });
    },

    // POST /v1/expenses/internal/confirm-settlement
    // Called by Payment Service after UPI payment confirmed
    async confirmSettlement(req: Request, res: Response): Promise<void> {
        const { settlement_id, payment_id } = req.body;
        await expenseService.confirmSettlement(settlement_id, payment_id);
        res.json({ success: true });
    },
};
