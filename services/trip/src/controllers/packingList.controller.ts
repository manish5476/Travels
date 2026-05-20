
import { Request, Response, NextFunction } from 'express';
import { packingListService } from '../services/packingList.service';

export const packingListController = {
    prePopulate: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await packingListService.prePopulate(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Packing list populated with AI suggestions' });
        } catch (err) { next(err); }
    },
    addItem: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await packingListService.addItem(req.params.id, req.user!.userId, req.body.item, req.body.category, req.body.assignedTo);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    togglePacked: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await packingListService.togglePacked(req.params.id, req.user!.userId, req.params.itemId);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    removeItem: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await packingListService.removeItem(req.params.id, req.params.itemId);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
};
