
import { Request, Response, NextFunction } from 'express';
import { followService } from '../services/follow.service';

export const followController = {

    // POST /v1/users/:id/follow
    follow: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await followService.follow(req.user!.userId, req.params.id);
            res.json({ success: true, data: { following: true } });
        } catch (err) { next(err); }
    },

    // DELETE /v1/users/:id/follow
    unfollow: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await followService.unfollow(req.user!.userId, req.params.id);
            res.json({ success: true, data: { following: false } });
        } catch (err) { next(err); }
    },

    // GET /v1/users/:id/followers
    getFollowers: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await followService.getFollowers(
                req.params.id, cursor, limit ? parseInt(limit) : 20
            );
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/users/:id/following
    getFollowing: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await followService.getFollowing(
                req.params.id, cursor, limit ? parseInt(limit) : 20
            );
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /internal/users/:id/follower-ids  (for Feed Service fan-out)
    getFollowerIds: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ids = await followService.getFollowerIds(req.params.id);
            res.json({ success: true, data: ids });
        } catch (err) { next(err); }
    },
};
