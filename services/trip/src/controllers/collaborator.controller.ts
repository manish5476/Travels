
import { Request, Response, NextFunction } from 'express';
import { collaboratorService } from '../services/collaborator.service';

export const collaboratorController = {
    invite: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.invite(req.params.id, req.user!.userId, req.body.userId, req.body.role);
            res.json({ success: true, message: 'Invite sent' });
        } catch (err) { next(err); }
    },
    acceptInvite: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.acceptInvite(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Joined trip' });
        } catch (err) { next(err); }
    },
    requestJoin: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.requestJoin(req.params.id, req.user!.userId, req.body.message);
            res.json({ success: true, message: 'Join request sent' });
        } catch (err) { next(err); }
    },
    handleRequest: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.handleJoinRequest(
                req.params.id, req.user!.userId, req.params.userId, req.body.action, req.body.role);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    remove: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.remove(req.params.id, req.user!.userId, req.params.userId);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
    updateRole: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await collaboratorService.updateRole(req.params.id, req.user!.userId, req.params.userId, req.body.role);
            res.json({ success: true });
        } catch (err) { next(err); }
    },
};
