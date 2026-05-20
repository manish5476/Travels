
import { Request, Response, NextFunction } from 'express';
import { aiPlannerService } from '../services/aiPlanner.service';

export const aiPlannerController = {
    generate: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await aiPlannerService.generate(req.params.id, req.body.regenerate);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
    vote: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { dayIndex, itemIndex, vote } = req.body;
            await aiPlannerService.vote(req.params.id, req.user!.userId, dayIndex, itemIndex, vote);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    commitAsWaypoint: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await aiPlannerService.commitAsWaypoint(req.params.id, req.user!.userId, req.body.dayIndex, req.body.itemIndex);
            res.json({ success: true, message: 'Added as waypoint' });
        } catch (err) { next(err); }
    },
};

