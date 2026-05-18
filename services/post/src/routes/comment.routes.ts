
import { Router } from 'express';
import { commentController } from '../controllers/comment.controller';
import { likeController } from '../controllers/like.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

export const commentRoutes = Router();

// GET  /v1/comments/:id/replies
commentRoutes.get('/:id/replies', commentController.getReplies);

// DELETE /v1/comments/:id
commentRoutes.delete('/:id', authMiddleware, commentController.delete);

// POST   /v1/comments/:id/like
// DELETE /v1/comments/:id/like
commentRoutes.post('/:id/like', authMiddleware, likeController.likeComment);
commentRoutes.delete('/:id/like', authMiddleware, likeController.unlikeComment);

