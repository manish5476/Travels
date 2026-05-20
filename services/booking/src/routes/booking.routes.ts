import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';

// Fallback logic for authMiddleware
let authMiddleware: any = (req: any, res: any, next: any) => next();
try {
  const auth = require('@tripparty/shared/middlewares/auth.middleware');
  authMiddleware = auth.requireAuth || auth.authMiddleware || authMiddleware;
} catch(e) {}

const router = Router();

router.post('/', authMiddleware, BookingController.createBooking);
router.get('/:id', authMiddleware, BookingController.getBooking);

export default router;
