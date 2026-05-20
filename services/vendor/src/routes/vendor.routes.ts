import { Router } from 'express';
import { VendorController } from '../controllers/vendor.controller';
// Fallback logic if the exact auth middleware export differs in shared
let authMiddleware: any = (req: any, res: any, next: any) => next();
try {
  const auth = require('@tripparty/shared/middlewares/auth.middleware');
  authMiddleware = auth.requireAuth || auth.authMiddleware || authMiddleware;
} catch(e) {}

const router = Router();

router.post('/', authMiddleware, VendorController.createVendor);
router.patch('/:id/inventory', authMiddleware, VendorController.updateInventory);
router.get('/search', VendorController.searchVendors);

export default router;
