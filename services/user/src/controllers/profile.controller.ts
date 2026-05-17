
import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { rankService } from '../services/rank.service';
import { followService } from '../services/follow.service';
import { blockService } from '../services/block.service';

export const profileController = {

    // GET /v1/users/me — own full profile
    getMe: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.getById(req.user!.userId);
            res.json({ success: true, data: user });
        } catch (err) { next(err); }
    },

    // POST /v1/users/me/xp — award XP (called internally by other services)
    awardXp: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await rankService.awardXp(req.user!.userId, req.body.action);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/users/:id/stats — travel stats for profile page
    getTravelStats: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.getById(req.params.id);
            res.json({
                success: true,
                data: {
                    travelStats: user.travelStats,
                    travelerRank: user.travelerRank,
                },
            });
        } catch (err) { next(err); }
    },

    // GET /v1/users/:id/relationship — is following + is blocked (for UI)
    getRelationship: async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                res.json({ success: true, data: { isFollowing: false, isBlocked: false, isBlockedBy: false } });
                return;
            }
            const [isFollowing, isBlocked, isBlockedBy] = await Promise.all([
                followService.isFollowing(req.user.userId, req.params.id),
                blockService.isBlocked(req.user.userId, req.params.id),
                blockService.isBlocked(req.params.id, req.user.userId),
            ]);
            res.json({ success: true, data: { isFollowing, isBlocked, isBlockedBy } });
        } catch (err) { next(err); }
    },
};
