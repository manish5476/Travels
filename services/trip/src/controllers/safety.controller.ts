
import { Request, Response, NextFunction } from 'express';
import { safetyService } from '../services/safety.service';

export const safetyController = {
    triggerSos: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await safetyService.triggerSos(req.params.id, req.user!.userId, req.body.location);
            res.json({ success: true, message: 'SOS triggered. Emergency contacts notified.' });
        } catch (err) { next(err); }
    },
    safeCheckin: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await safetyService.safeCheckin(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Safe check-in recorded' });
        } catch (err) { next(err); }
    },
    generateTrustedLink: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const link = await safetyService.generateTrustedContactLink(req.params.id, req.user!.userId);
            res.json({ success: true, data: { link } });
        } catch (err) { next(err); }
    },
    setEmergencyMode: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await safetyService.setEmergencyMode(req.params.id, req.user!.userId, req.body.active);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    updateSosContacts: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await safetyService.updateSosContacts(req.params.id, req.user!.userId, req.body.contacts);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
};

