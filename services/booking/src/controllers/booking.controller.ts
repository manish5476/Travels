import { Request, Response } from 'express';
import { BookingService } from '../services/booking.service';

export class BookingController {
  static async createBooking(req: Request, res: Response) {
    const userId = (req as any).user?.id || req.body.user_id; // fallback if no auth user
    const bookingData = { ...req.body, user_id: userId };
    const booking = await BookingService.createBooking(bookingData);
    res.status(201).json(booking);
  }

  static async getBooking(req: Request, res: Response) {
    const { id } = req.params;
    const booking = await BookingService.getBookingById(id);
    res.status(200).json(booking);
  }
}
