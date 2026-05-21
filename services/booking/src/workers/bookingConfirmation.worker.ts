// Listens to trip.state_changed — if CANCELLED, cancels all trip bookings
import { Kafka } from 'kafkajs';
import { BookingModel } from '../models/booking.model';
import { bookingService } from '../services/booking.service';
import { logger } from '@tripparty/shared';
import { config } from '../config/index';

export async function startBookingWorker() {
    const kafka = new Kafka({
        clientId: config.SERVICE_NAME,
        brokers: config.KAFKA_BROKERS.split(','),
    });

    const consumer = kafka.consumer({ groupId: 'booking-service-group' });
    await consumer.connect();
    await consumer.subscribe({ topics: ['trip.state_changed', 'booking.completed'] });

    await consumer.run({
        eachMessage: async ({ topic, message }) => {
            const payload = JSON.parse(message.value?.toString() || '{}');

            // ── Trip cancelled → cancel all pending/confirmed bookings ─────
            if (topic === 'trip.state_changed' && payload.new_status === 'CANCELLED') {
                const bookings = await BookingModel.find({
                    trip_id: payload.trip_id,
                    status: { $in: ['pending_payment', 'confirmed'] },
                });
                for (const b of bookings) {
                    try {
                        await bookingService.cancelBooking(b._id.toString(), b.user_id, 'trip_cancelled');
                    } catch (err) {
                        logger.error({ err, booking_id: b._id }, 'Auto-cancel failed');
                    }
                }
                logger.info({ trip_id: payload.trip_id, count: bookings.length }, 'Auto-cancelled bookings for cancelled trip');
            }

            // ── booking.completed → trigger T+1 settlement (published for Payment Service) ─
            // Payment Service consumes booking.completed and initiates payout
            // No action needed here — just log
            if (topic === 'booking.completed') {
                logger.info({ booking_id: payload.booking_id }, 'Booking completed — settlement queued');
            }
        },
    });

    logger.info('Booking Kafka worker started');
}
