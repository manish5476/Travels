import { Router } from 'express';
import { vendorController } from '../controllers/vendor.controller';
import { authMiddleware, internalServiceMiddleware } from '@tripparty/shared';
import { validate, createVendorSchema, blockDatesSchema, reviewSchema } from '../validators/vendor.validators';

const router = Router();

// ── Public endpoints ──────────────────────────────────────────────────────
router.get('/nearby', vendorController.searchNearby);
router.get('/:id', vendorController.getVendor);
router.get('/:id/reviews', vendorController.getReviews);
router.get('/:id/availability', vendorController.checkAvailability);

// ── Vendor-authenticated endpoints ────────────────────────────────────────
router.post('/', authMiddleware, validate(createVendorSchema), vendorController.createVendor);
router.patch('/:id', authMiddleware, vendorController.updateVendor);
router.post('/:id/catalog', authMiddleware, vendorController.upsertCatalogItem);
router.patch('/:id/calendar', authMiddleware, validate(blockDatesSchema), vendorController.blockDates);
router.post('/reviews/:review_id/reply', authMiddleware, vendorController.replyToReview);

// ── User endpoints ────────────────────────────────────────────────────────
router.post('/reviews', authMiddleware, validate(reviewSchema), vendorController.submitReview);

// ── Internal (service-to-service) endpoints ───────────────────────────────
// Called by Booking Service after payment confirmed
router.post('/internal/mark-booked', internalServiceMiddleware, vendorController.markDateBooked);
// Called by Admin service
router.patch('/internal/:id/kyc', internalServiceMiddleware, vendorController.updateKyc);

export default router;









// import { Router } from 'express';
// import { VendorController } from '../controllers/vendor.controller';
// // Fallback logic if the exact auth middleware export differs in shared
// let authMiddleware: any = (req: any, res: any, next: any) => next();
// try {
//   const auth = require('@tripparty/shared/middlewares/auth.middleware');
//   authMiddleware = auth.requireAuth || auth.authMiddleware || authMiddleware;
// } catch(e) {}

// const router = Router();

// router.post('/', authMiddleware, VendorController.createVendor);
// router.patch('/:id/inventory', authMiddleware, VendorController.updateInventory);
// router.get('/search', VendorController.searchVendors);

// export default router;
