import crypto from 'crypto';
import QRCode from 'qrcode';
import Razorpay from 'razorpay';
import { BookingModel } from '../models/booking.model';
import { redis } from '../config/redis';
import { publishEvent } from '@tripparty/shared';
import { Errors } from '@tripparty/shared';
import { logger } from '@tripparty/shared';
import { config } from '../config/index';
import axios from 'axios';

const razorpay = new Razorpay({
  key_id: config.RAZORPAY_KEY_ID,
  key_secret: config.RAZORPAY_KEY_SECRET,
});

// ── Commission table (matches blueprint) ─────────────────────────────────
function calcFee(subtotal: number, vendorTier: string): { platform_fee: number; tax: number; total: number } {
  let pct = 0.08;
  if (subtotal > 20000) pct = 0.05;
  else if (subtotal > 5000) pct = 0.06;
  else if (subtotal > 1000) pct = 0.07;
  // Tier discount
  if (vendorTier === 'premium') pct = Math.min(pct, 0.05);
  if (vendorTier === 'growth') pct = Math.min(pct, 0.06);
  if (vendorTier === 'basic') pct = Math.min(pct, 0.07);
  const platform_fee = Math.round(subtotal * pct * 100) / 100;
  const tax = Math.round(platform_fee * 0.18 * 100) / 100;  // 18% GST on fee
  const total = subtotal + platform_fee + tax;
  return { platform_fee, tax, total };
}

// ── Redis inventory lock (15 min TTL) ────────────────────────────────────
async function acquireLock(key: string, ttlSec = 900): Promise<boolean> {
  const result = await redis.set(key, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}
async function releaseLock(key: string) {
  await redis.del(key);
}

export const bookingService = {

  // ── Create booking + Razorpay order ──────────────────────────────────
  async createBooking(params: {
    user_id: string;
    vendor_id: string;
    catalog_item_id: string;
    vendor_tier: string;
    dates: any;
    guests: any[];
    subtotal: number;
    cancellation_policy: any;
    trip_id?: string;
  }) {
    const { user_id, vendor_id, catalog_item_id, vendor_tier,
      dates, guests, subtotal, cancellation_policy, trip_id } = params;

    // ── Idempotency key — prevents double-booking on retry ────────────
    const tsBucket = Math.floor(Date.now() / 30000); // 30-second bucket
    const idempotency_key = `${user_id}:${vendor_id}:${catalog_item_id}:${tsBucket}`;

    const existing = await BookingModel.findOne({ idempotency_key });
    if (existing) {
      logger.info({ idempotency_key }, 'Duplicate booking request — returning existing');
      return existing;
    }

    // ── Redis lock to prevent concurrent same-slot booking ────────────
    const lockKey = `lock:booking:${vendor_id}:${catalog_item_id}`;
    const locked = await acquireLock(lockKey, 30);
    if (!locked) throw Errors.conflict('This slot is being booked by another user. Try again in a moment.');

    try {
      const { platform_fee, tax, total } = calcFee(subtotal, vendor_tier);

      // ── Create Razorpay order ─────────────────────────────────────
      const rzpOrder = await razorpay.orders.create({
        amount: Math.round(total * 100),  // paise
        currency: 'INR',
        receipt: idempotency_key.slice(0, 40),
        notes: { vendor_id, catalog_item_id, user_id },
      });

      // ── Persist booking in pending_payment state ──────────────────
      const booking = await BookingModel.create({
        trip_id, user_id, vendor_id, catalog_item_id, guests, dates,
        amount: { subtotal, platform_fee, tax, total, currency: 'INR' },
        razorpay_order_id: rzpOrder.id,
        idempotency_key,
        cancellation_policy,
        status: 'pending_payment',
      });

      await publishEvent('booking.created', booking._id.toString(), {
        booking_id: booking._id, user_id, vendor_id, trip_id,
        amount: total, status: 'pending_payment',
      });

      return { booking, razorpay_order_id: rzpOrder.id, razorpay_key: config.RAZORPAY_KEY_ID };

    } finally {
      await releaseLock(lockKey);
    }
  },

  // ── Handle Razorpay webhook (payment.captured) ────────────────────
  async handlePaymentWebhook(payload: any, signature: string) {
    // ── HMAC-SHA256 signature verification ────────────────────────
    const expected = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (expected !== signature) {
      logger.warn('Invalid Razorpay webhook signature');
      throw Errors.badRequest('Invalid signature');
    }

    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    if (!payment) return { ignored: true };

    const booking = await BookingModel.findOne({ razorpay_order_id: payment.order_id });
    if (!booking) {
      logger.error({ order_id: payment.order_id }, 'Booking not found for webhook');
      return { ignored: true };
    }

    if (event === 'payment.captured' && booking.status === 'pending_payment') {
      booking.payment_id = payment.id;
      booking.status = 'confirmed';
      booking.confirmed_at = new Date();

      // ── Generate QR code ────────────────────────────────────────
      const qrPayload = JSON.stringify({
        booking_id: booking._id,
        vendor_id: booking.vendor_id,
        user_id: booking.user_id,
        amount: booking.amount.total,
        confirmed: booking.confirmed_at,
      });
      booking.qr_code_url = await QRCode.toDataURL(qrPayload);

      await booking.save();

      // ── Notify vendor service to mark calendar ───────────────────
      const dates = _extractDates(booking.dates);
      if (dates.length > 0) {
        await axios.post(`${config.VENDOR_SERVICE_URL}/v1/vendors/internal/mark-booked`, {
          vendor_id: booking.vendor_id,
          catalog_item_id: booking.catalog_item_id,
          dates,
        }, { headers: { 'x-internal-secret': config.INTERNAL_SERVICE_SECRET } });
      }

      await publishEvent('booking.confirmed', booking._id.toString(), {
        booking_id: booking._id,
        user_id: booking.user_id,
        vendor_id: booking.vendor_id,
        trip_id: booking.trip_id,
        amount: booking.amount.total,
        qr_code_url: booking.qr_code_url,
      });

      logger.info({ booking_id: booking._id }, 'Booking confirmed');

    } else if (event === 'payment.failed') {
      booking.status = 'cancelled';
      booking.cancellation_reason = 'payment_failed';
      await booking.save();
      await publishEvent('booking.cancelled', booking._id.toString(), {
        booking_id: booking._id, reason: 'payment_failed',
      });
    }

    return { processed: true };
  },

  // ── Vendor scans QR at venue (check-in) ──────────────────────────
  async checkIn(bookingId: string, vendorUserId: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw Errors.notFound('Booking');
    if (booking.status !== 'confirmed') throw Errors.badRequest('Booking is not in confirmed state');

    // Verify vendor owns this booking's vendor
    const vendor = await axios.get(
      `${config.VENDOR_SERVICE_URL}/v1/vendors/${booking.vendor_id}`
    );
    if (vendor.data.data.owner_user_id !== vendorUserId) throw Errors.forbidden();

    booking.status = 'active';
    booking.checked_in_at = new Date();
    await booking.save();

    await publishEvent('booking.checked_in', bookingId, {
      booking_id: bookingId, vendor_id: booking.vendor_id,
    });

    return booking;
  },

  // ── Complete booking (T+1 settlement trigger) ─────────────────────
  async completeBooking(bookingId: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw Errors.notFound('Booking');
    if (booking.status !== 'active') throw Errors.badRequest('Booking must be active to complete');

    booking.status = 'completed';
    booking.completed_at = new Date();
    booking.review_unlocked = true;  // User can now write review
    await booking.save();

    await publishEvent('booking.completed', bookingId, {
      booking_id: bookingId,
      vendor_id: booking.vendor_id,
      user_id: booking.user_id,
      amount: booking.amount,
      // Payment service consumes this and initiates T+1 settlement
    });

    return booking;
  },

  // ── Cancel booking ────────────────────────────────────────────────
  async cancelBooking(bookingId: string, userId: string, reason: string) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw Errors.notFound('Booking');
    if (booking.user_id !== userId) throw Errors.forbidden();

    const cancellable = ['pending_payment', 'confirmed'];
    if (!cancellable.includes(booking.status))
      throw Errors.badRequest(`Cannot cancel a booking in ${booking.status} state`);

    // ── Refund calculation based on cancellation policy ───────────
    let refund_amount = 0;
    if (booking.status === 'confirmed' && booking.payment_id) {
      const now = new Date();
      const deadline = booking.cancellation_policy?.deadline;
      const pct = deadline && now < deadline ? booking.cancellation_policy.refund_percent : 0;
      refund_amount = Math.round(booking.amount.total * (pct / 100) * 100) / 100;

      if (refund_amount > 0) {
        await razorpay.payments.refund(booking.payment_id, {
          amount: Math.round(refund_amount * 100),
          notes: { reason, booking_id: bookingId },
        });
      }
    }

    booking.status = refund_amount > 0 ? 'refunded' : 'cancelled';
    booking.cancellation_reason = reason;
    booking.refund_amount = refund_amount;
    await booking.save();

    await publishEvent('booking.cancelled', bookingId, {
      booking_id: bookingId, vendor_id: booking.vendor_id,
      user_id: userId, reason, refund_amount,
    });

    return booking;
  },

  // ── Get user's bookings ───────────────────────────────────────────
  async getUserBookings(userId: string, status?: string) {
    const query: any = { user_id: userId };
    if (status) query.status = status;
    return BookingModel.find(query).sort({ created_at: -1 }).limit(50).lean();
  },

  // ── Get vendor's bookings (vendor dashboard) ──────────────────────
  async getVendorBookings(vendorId: string, status?: string) {
    const query: any = { vendor_id: vendorId };
    if (status) query.status = status;
    return BookingModel.find(query).sort({ created_at: -1 }).limit(100).lean();
  },

  // ── Verify QR code (vendor scans to validate) ─────────────────────
  async verifyQr(qrPayload: string) {
    const data = JSON.parse(qrPayload);
    const booking = await BookingModel.findById(data.booking_id).lean();
    if (!booking) throw Errors.notFound('Booking');
    if (booking.status !== 'confirmed') throw Errors.badRequest('Booking not in confirmed state');
    return { valid: true, booking };
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function _extractDates(dates: any): string[] {
  const result: string[] = [];
  if (dates.check_in && dates.check_out) {
    const cur = new Date(dates.check_in);
    const end = new Date(dates.check_out);
    while (cur <= end) {
      result.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }
  } else if (dates.date) {
    result.push(new Date(dates.date).toISOString().split('T')[0]);
  }
  return result;
}
