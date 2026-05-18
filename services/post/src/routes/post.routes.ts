
import { Router } from 'express';
import { postController } from '../controllers/post.controller';
import { likeController } from '../controllers/like.controller';
import { commentController } from '../controllers/comment.controller';
import { saveController } from '../controllers/save.controller';
import { reportController } from '../controllers/report.controller';
import { authMiddleware, optionalAuth } from '../middlewares/auth.middleware';
import { validateBody } from '../validators/post.validator';

export const postRoutes = Router();

// ── POST CRUD ─────────────────────────────────────────────────
postRoutes.post('/', authMiddleware, validateBody('createPost'), postController.create);
postRoutes.get('/trending/hashtags', postController.getTrendingHashtags);
postRoutes.get('/user/:authorId', optionalAuth, postController.getByAuthor);
postRoutes.get('/hashtag/:tag', optionalAuth, postController.getByHashtag);
postRoutes.get('/trip/:tripId/timeline', authMiddleware, postController.getTripTimeline);
postRoutes.get('/saved', authMiddleware, saveController.getSaved);
postRoutes.get('/:id', optionalAuth, postController.getById);
postRoutes.patch('/:id', authMiddleware, validateBody('updatePost'), postController.update);
postRoutes.delete('/:id', authMiddleware, postController.delete);

// ── LIKES ─────────────────────────────────────────────────────
postRoutes.post('/:id/like', authMiddleware, likeController.like);
postRoutes.delete('/:id/like', authMiddleware, likeController.unlike);
postRoutes.get('/:id/likes', optionalAuth, likeController.getLikers);

// ── COMMENTS ──────────────────────────────────────────────────
postRoutes.post('/:id/comments', authMiddleware, validateBody('createComment'), commentController.create);
postRoutes.get('/:id/comments', optionalAuth, commentController.getForPost);

// ── SAVES ─────────────────────────────────────────────────────
postRoutes.post('/:id/save', authMiddleware, saveController.save);
postRoutes.delete('/:id/save', authMiddleware, saveController.unsave);

// ── REPORT ────────────────────────────────────────────────────
postRoutes.post('/:id/report', authMiddleware, validateBody('reportPost'), reportController.report);

// ── COMMENT NESTED ROUTES ─────────────────────────────────────
// (Comment replies and comment likes use a separate router mounted in app.ts)
