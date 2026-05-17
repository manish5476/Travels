
import { Request, Response, NextFunction } from 'express';
import { blockService } from '../services/block.service';

export const blockController = {

    // POST /v1/users/:id/block
    block: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await blockService.block(req.user!.userId, req.params.id);
            res.json({ success: true, data: { blocked: true } });
        } catch (err) { next(err); }
    },

    // DELETE /v1/users/:id/block
    unblock: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await blockService.unblock(req.user!.userId, req.params.id);
            res.json({ success: true, data: { blocked: false } });
        } catch (err) { next(err); }
    },

    // GET /v1/users/me/blocked
    getBlockedList: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await blockService.getBlockedList(req.user!.userId);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
};
