
import { Request, Response, NextFunction } from 'express';
import { commentService } from '../services/comment.service';

export const commentController = {

    // POST /v1/posts/:id/comments
    create: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { text, parentId } = req.body;
            const comment = await commentService.create(req.params.id, req.user!.userId, text, parentId);
            res.status(201).json({ success: true, data: comment });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/:id/comments
    getForPost: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await commentService.getForPost(req.params.id, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/comments/:id/replies
    getReplies: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await commentService.getReplies(req.params.id, cursor, limit ? parseInt(limit) : 10);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // DELETE /v1/comments/:id
    delete: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await commentService.delete(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Comment deleted' });
        } catch (err) { next(err); }
    },
};
