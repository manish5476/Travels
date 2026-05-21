/**
 * expense.worker.ts
 *
 * Kafka consumer for the Expense Service.
 *
 * Subscribed topics:
 *   trip.state_changed   → when trip is CANCELLED, delete all unsettled expenses
 *   payment.settled      → when Payment Service confirms a UPI settlement
 */
import { Kafka } from 'kafkajs';
import { ExpenseModel } from '../models/expense.model';
import { expenseService } from '../services/expense.service';
import { config, logger } from '../config/index';

export async function startExpenseWorker(): Promise<void> {
    const kafka = new Kafka({
        clientId: `${config.SERVICE_NAME}-worker`,
        brokers: config.KAFKA_BROKERS.split(',').map(b => b.trim()),
        ssl: config.NODE_ENV === 'production',
    });

    const consumer = kafka.consumer({ groupId: 'expense-service-group' });
    await consumer.connect();
    await consumer.subscribe({
        topics: ['trip.state_changed', 'payment.settled'],
        fromBeginning: false,
    });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            let payload: any;
            try {
                payload = JSON.parse(message.value?.toString() || '{}');
            } catch (e) {
                logger.error({ topic }, 'Failed to parse Kafka message');
                return;
            }

            // ── trip.state_changed → trip CANCELLED ──────────────────────
            if (topic === 'trip.state_changed' && payload.new_status === 'CANCELLED') {
                const { trip_id } = payload;
                logger.info({ trip_id }, 'Trip cancelled — deleting unsettled expenses');

                // Soft approach: mark all unsettled expenses as settled=true (no money changed)
                // Hard delete is too destructive — audit trail is lost
                const result = await ExpenseModel.updateMany(
                    { trip_id, is_settled: false },
                    { $set: { is_settled: true } }
                );
                logger.info({ trip_id, modified: result.modifiedCount }, 'Expenses marked settled on trip cancel');
            }

            // ── payment.settled → UPI settlement confirmed ────────────────
            // Payment Service (8014) publishes this after Razorpay webhook
            if (topic === 'payment.settled' && payload.context === 'expense_settlement') {
                const { settlement_id, payment_id } = payload;
                try {
                    await expenseService.confirmSettlement(settlement_id, payment_id);
                } catch (err: any) {
                    // CONFLICT = already processed (idempotent) — safe to ignore
                    if (err?.code !== 'CONFLICT') {
                        logger.error({ err, settlement_id }, 'Failed to confirm settlement');
                    }
                }
            }
        },
    });

    logger.info('✅ Expense Kafka worker started');
}
