import { Router } from 'express';
import { expenseController } from '../controllers/expense.controller';
import { authMiddleware, internalServiceMiddleware } from '@tripparty/shared';
import { validate, addExpenseSchema, settleSchema, confirmSettlementSchema } from '../validators/expense.validators';

const router = Router();

// ── Collaborator-authenticated endpoints ──────────────────────────────────────
// Note: trip membership verification is done in the service layer via
// internalServiceMiddleware call to Trip Service
router.post('/', authMiddleware, validate(addExpenseSchema), expenseController.addExpense);
router.get('/trip/:tripId', authMiddleware, expenseController.getTripExpenses);
router.delete('/:id', authMiddleware, expenseController.deleteExpense);
router.get('/trip/:tripId/summary', authMiddleware, expenseController.getBalanceSummary);
router.post('/settle', authMiddleware, validate(settleSchema), expenseController.initiateSettlement);
router.get('/trip/:tripId/settlements', authMiddleware, expenseController.getTripSettlements);
router.get('/trip/:tripId/export', authMiddleware, expenseController.getExportData);

// ── Internal service-to-service endpoints ────────────────────────────────────
// Payment Service calls this after UPI settlement is confirmed
router.post('/internal/confirm-settlement', internalServiceMiddleware, validate(confirmSettlementSchema), expenseController.confirmSettlement);

export default router;
