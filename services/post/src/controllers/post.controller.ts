
import { Request, Response, NextFunction } from 'express';
import { postService } from '../services/post.service';
import { hashtagService } from '../services/hashtag.service';

export const postController = {

    // POST /v1/posts
    create: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const post = await postService.create({ ...req.body, authorId: req.user!.userId });
            res.status(201).json({ success: true, data: post });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/:id
    getById: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const post = await postService.getById(req.params.id, req.user?.userId);
            res.json({ success: true, data: post });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/user/:authorId
    getByAuthor: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await postService.getByAuthor(req.params.authorId, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/hashtag/:tag
    getByHashtag: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await postService.getByHashtag(req.params.tag, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/trip/:tripId/timeline
    getTripTimeline: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await postService.getTripTimeline(req.params.tripId, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/posts/trending/hashtags
    getTrendingHashtags: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trending = await hashtagService.getTrending(20);
            res.json({ success: true, data: trending });
        } catch (err) { next(err); }
    },

    // PATCH /v1/posts/:id
    update: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const post = await postService.update(req.params.id, req.user!.userId, req.body);
            res.json({ success: true, data: post });
        } catch (err) { next(err); }
    },

    // DELETE /v1/posts/:id
    delete: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await postService.softDelete(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Post deleted' });
        } catch (err) { next(err); }
    },
};
