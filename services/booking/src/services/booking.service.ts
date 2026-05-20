import { Booking, IBooking } from '../models/booking.model';
import { HttpError } from '@tripparty/shared/errors/HttpError';
// Import Kafka producer singleton
let kafkaProducer: any = { publish: async () => {} };
try {
  const producer = require('@tripparty/shared/events/kafkaProducer');
  kafkaProducer = producer.kafkaProducer || producer.KafkaProducer || kafkaProducer;
} catch (e) {}

// Redis setup for mock inventory check
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URI || 'redis://localhost:6379');

export class BookingService {
  static async createBooking(data: Partial<IBooking>) {
    const { vendor_id, dates } = data;

    // (Mock step): Check Redis to ensure the inventory isn't currently locked
    const lockKey = `inventory_lock:${vendor_id}:${dates?.check_in?.toISOString()}`;
    const isLocked = await redis.get(lockKey);

    if (isLocked) {
      throw new HttpError(409, 'Inventory is currently locked by someone else');
    }

    // Set a temporary lock for 5 minutes while payment is pending
    await redis.set(lockKey, 'locked', 'EX', 300);

    // Create the Booking in MongoDB with status pending
    const booking = new Booking({
      ...data,
      status: 'pending' // pending_payment
    });

    await booking.save();

    // Publish a Kafka event: booking.created containing the booking details
    try {
      await kafkaProducer.publish('booking.created', {
        bookingId: booking._id,
        vendorId: booking.vendor_id,
        userId: booking.user_id,
        status: booking.status,
        amount: booking.amount,
        dates: booking.dates
      });
    } catch (err) {
      console.error('Failed to publish booking.created event', err);
    }

    return booking;
  }

  static async getBookingById(id: string) {
    const booking = await Booking.findById(id);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    return booking;
  }
}
