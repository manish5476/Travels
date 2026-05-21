import { Router } from 'express';
import { bookingController } from '../controllers/booking.controller';
import { authMiddleware } from '@tripparty/shared';
import { validate, createBookingSchema, cancelBookingSchema, verifyQrSchema } from '../validators/booking.validators';
import express from 'express';

const router = Router();

// ── Razorpay webhook — raw body required for HMAC verification ────────────
router.post('/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  bookingController.razorpayWebhook
);

// ── User endpoints ────────────────────────────────────────────────────────
router.get('/me', authMiddleware, bookingController.getMyBookings);
router.post('/', authMiddleware, validate(createBookingSchema), bookingController.createBooking);
router.delete('/:id', authMiddleware, validate(cancelBookingSchema), bookingController.cancelBooking);
router.post('/verify-qr', authMiddleware, validate(verifyQrSchema), bookingController.verifyQr);

// ── Vendor dashboard endpoints ────────────────────────────────────────────
router.get('/vendor/:vendorId', authMiddleware, bookingController.getVendorBookings);
router.post('/:id/checkin', authMiddleware, bookingController.checkIn);
router.post('/:id/complete', authMiddleware, bookingController.completeBooking);

export default router;
