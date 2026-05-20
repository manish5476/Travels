
import { Request, Response, NextFunction } from 'express';
import { waypointService } from '../services/waypoint.service';

export const waypointController = {
    add: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const wp = await waypointService.add(req.params.id, req.user!.userId, req.body);
            res.status(201).json({ success: true, data: wp });
        } catch (err) { next(err); }
    },
    checkIn: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await waypointService.checkIn(req.params.id, req.user!.userId, parseInt(req.params.idx));
            res.json({ success: true, message: 'Checked in' });
        } catch (err) { next(err); }
    },
    reorder: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await waypointService.reorder(req.params.id, req.user!.userId, req.body.order);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
};
