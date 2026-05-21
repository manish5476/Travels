import { Request, Response, NextFunction } from 'express';
import { bookingService } from '../services/booking.service';
import axios from 'axios';
import { config } from '../config/index';
import { Errors } from '@tripparty/shared';

export const bookingController = {

  // POST /v1/bookings
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { vendor_id, catalog_item_id, dates, guests, trip_id } = req.body;

      // Fetch vendor to get current pricing and tier
      const vendorRes = await axios.get(`${config.VENDOR_SERVICE_URL}/v1/vendors/${vendor_id}`);
      const vendor = vendorRes.data.data;
      if (!vendor || !vendor.is_active) throw Errors.badRequest('Vendor not available');

      const item = vendor.catalog.find((c: any) => c.id === catalog_item_id && c.active);
      if (!item) throw Errors.notFound('Catalog item');

      // Calculate subtotal based on dates + guests
      const nights = dates.check_in && dates.check_out
        ? Math.ceil((new Date(dates.check_out).getTime() - new Date(dates.check_in).getTime()) / 86400000)
        : dates.duration_hours ? dates.duration_hours : 1;

      const guestCount = Math.max(guests?.length || 1, 1);
      const subtotal = item.unit === 'per_person'
        ? item.price * guestCount
        : item.unit === 'per_night' ? item.price * nights : item.price;

      const cancellation_policy = {
        deadline: new Date(Date.now() + 24 * 3600 * 1000), // 24h before
        refund_percent: 80,
      };

      const result = await bookingService.createBooking({
        user_id: req.user!.userId,
        vendor_id, catalog_item_id,
        vendor_tier: vendor.subscription_tier,
        dates, guests, subtotal, cancellation_policy, trip_id,
      });

      res.status(201).json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  // POST /v1/bookings/webhook/razorpay
  async razorpayWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const result = await bookingService.handlePaymentWebhook(req.body, signature);
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  },

  // POST /v1/bookings/:id/checkin
  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.checkIn(req.params.id, req.user!.userId);
      res.json({ success: true, data: booking });
    } catch (e) { next(e); }
  },

  // POST /v1/bookings/:id/complete
  async completeBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.completeBooking(req.params.id);
      res.json({ success: true, data: booking });
    } catch (e) { next(e); }
  },

  // DELETE /v1/bookings/:id
  async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const booking = await bookingService.cancelBooking(
        req.params.id, req.user!.userId, req.body.reason || 'user_cancelled'
      );
      res.json({ success: true, data: booking });
    } catch (e) { next(e); }
  },

  // GET /v1/bookings/me
  async getMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const bookings = await bookingService.getUserBookings(req.user!.userId, req.query.status as string);
      res.json({ success: true, data: bookings });
    } catch (e) { next(e); }
  },

  // GET /v1/bookings/vendor/:vendorId
  async getVendorBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const bookings = await bookingService.getVendorBookings(
        req.params.vendorId, req.query.status as string
      );
      res.json({ success: true, data: bookings });
    } catch (e) { next(e); }
  },

  // POST /v1/bookings/verify-qr
  async verifyQr(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.verifyQr(req.body.qr_payload);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },
};
