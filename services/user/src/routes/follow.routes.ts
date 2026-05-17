
import { Router } from 'express';
import { followController } from '../controllers/follow.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const followRoutes = Router({ mergeParams: true });

// POST   /v1/users/:id/follow
// DELETE /v1/users/:id/follow
followRoutes.post('/', authMiddleware, followController.follow);
followRoutes.delete('/', authMiddleware, followController.unfollow);

// GET /v1/users/:id/followers
// GET /v1/users/:id/following
followRoutes.get('/followers', followController.getFollowers);
followRoutes.get('/following', followController.getFollowing);

// INTERNAL
followRoutes.get('/follower-ids', followController.getFollowerIds);
