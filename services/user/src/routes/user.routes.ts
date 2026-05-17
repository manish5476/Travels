
import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { profileController } from '../controllers/profile.controller';
import { blockController } from '../controllers/block.controller';
import { authMiddleware, optionalAuth } from '../middlewares/auth.middleware';
import { validateBody, validateQuery } from '../validators/user.validator';

export const userRoutes = Router();

// ── OWN PROFILE (protected) ──────────────────────────────────
userRoutes.get('/me', authMiddleware, profileController.getMe);
userRoutes.patch('/me', authMiddleware, validateBody('updateProfile'), userController.updateProfile);
userRoutes.get('/me/blocked', authMiddleware, blockController.getBlockedList);
userRoutes.post('/me/device-token', authMiddleware, validateBody('deviceToken'), userController.upsertDeviceToken);
userRoutes.get('/me/avatar/upload-urls', authMiddleware, userController.getAvatarUploadUrls);
userRoutes.post('/me/avatar/confirm', authMiddleware, userController.confirmAvatarUpload);
userRoutes.delete('/me/avatar', authMiddleware, userController.removeAvatar);
userRoutes.post('/me/xp', authMiddleware, validateBody('awardXp'), profileController.awardXp);

// ── SEARCH (public) ──────────────────────────────────────────
userRoutes.get('/search', validateQuery('searchQuery'), userController.search);

// ── PUBLIC PROFILE ───────────────────────────────────────────
userRoutes.get('/:username', optionalAuth, userController.getProfile);
userRoutes.get('/:id/stats', optionalAuth, profileController.getTravelStats);
userRoutes.get('/:id/relationship', optionalAuth, profileController.getRelationship);

// ── BLOCK ────────────────────────────────────────────────────
userRoutes.post('/:id/block', authMiddleware, blockController.block);
userRoutes.delete('/:id/block', authMiddleware, blockController.unblock);

// ── INTERNAL (not exposed via API Gateway) ───────────────────
userRoutes.get('/internal/:id/device-tokens', userController.getDeviceTokens);
userRoutes.get('/internal/:id/profile', userController.getProfileInternal);
