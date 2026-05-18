
import { Request, Response, NextFunction } from 'express';
import { reportService } from '../services/report.service';

export const reportController = {

    // POST /v1/posts/:id/report
    report: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { reason, description } = req.body;
            await reportService.report(req.params.id, req.user!.userId, reason, description);
            res.json({ success: true, message: 'Report submitted. Our team will review it.' });
        } catch (err) { next(err); }
    },
};
