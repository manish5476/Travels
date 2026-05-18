
import { Request, Response, NextFunction } from 'express';
import { feedService } from '../services/feed.service';
import { storyTrayService } from '../services/storyTray.service';

export const feedController = {

    // GET /v1/feed  — Main home feed
    getHomeFeed: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await feedService.getHomeFeed(
                req.user!.userId, cursor, limit ? parseInt(limit) : 20
            );
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/feed/stories  — Story tray
    getStoryTray: async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get following IDs from User Service
            const res2 = await fetch(
                `${process.env.USER_SERVICE_URL}/internal/${req.user!.userId}/follower-ids`
            );
            const followingIds = res2.ok ? (await res2.json() as any).data || [] : [];
            const tray = await storyTrayService.getTray(req.user!.userId, followingIds);
            res.json({ success: true, data: tray });
        } catch (err) { next(err); }
    },

    // POST /v1/feed/story/:storyId/seen  — Mark story as viewed
    markStorySeen: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await storyTrayService.markSeen(req.user!.userId, req.params.storyId);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
};
