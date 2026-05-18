
import { Router } from 'express';
import { feedController } from '../controllers/feed.controller';
import { exploreController } from '../controllers/explore.controller';
import { authMiddleware, optionalAuth } from '../middlewares/auth.middleware';

export const feedRoutes = Router();

// ── HOME FEED ─────────────────────────────────────────────
feedRoutes.get('/', authMiddleware, feedController.getHomeFeed);
feedRoutes.get('/stories', authMiddleware, feedController.getStoryTray);
feedRoutes.post('/story/:storyId/seen', authMiddleware, feedController.markStorySeen);

// ── EXPLORE ───────────────────────────────────────────────
feedRoutes.get('/explore', optionalAuth, exploreController.getExplore);
feedRoutes.get('/trending/hashtags', exploreController.getTrendingHashtags);
feedRoutes.get('/nearby', optionalAuth, exploreController.getNearbyPosts);
