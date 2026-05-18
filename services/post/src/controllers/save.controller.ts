
import { Request, Response, NextFunction } from 'express';
import { saveService } from '../services/save.service';

export const saveController = {

    save: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await saveService.save(req.params.id, req.user!.userId);
            res.json({ success: true, data: { saved: true } });
        } catch (err) { next(err); }
    },

    unsave: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await saveService.unsave(req.params.id, req.user!.userId);
            res.json({ success: true, data: { saved: false } });
        } catch (err) { next(err); }
    },

    getSaved: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await saveService.getSavedByUser(req.user!.userId, cursor, limit ? parseInt(limit) : 20);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
};

