
import { Request, Response, NextFunction } from 'express';
import { likeService } from '../services/like.service';

export const likeController = {

    // POST /v1/posts/:id/like
    like: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await likeService.like(req.params.id, 'post', req.user!.userId);
            res.json({ success: true, data: { liked: true } });
        } catch (err) { next(err); }
    },

    // DELETE /v1/posts/:id/like
    unlike: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await likeService.unlike(req.params.id, 'post', req.user!.userId);
            res.json({ success: true, data: { liked: false } });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/:id/likes
    getLikers: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await likeService.getLikers(req.params.id, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // POST /v1/comments/:id/like
    likeComment: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await likeService.like(req.params.id, 'comment', req.user!.userId);
            res.json({ success: true, data: { liked: true } });
        } catch (err) { next(err); }
    },

    // DELETE /v1/comments/:id/like
    unlikeComment: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await likeService.unlike(req.params.id, 'comment', req.user!.userId);
            res.json({ success: true, data: { liked: false } });
        } catch (err) { next(err); }
    },
};
