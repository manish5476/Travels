
import { Request, Response, NextFunction } from 'express';
import { messageService } from '../services/message.service';

export const messageController = {

    // GET /v1/messages/conversations/:id/messages
    getHistory: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await messageService.getForConversation(
                req.params.id, req.user!.userId, cursor, limit ? parseInt(limit) : 40
            );
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // DELETE /v1/messages/:id (for me)
    deleteForMe: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await messageService.deleteForUser(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Message hidden for you' });
        } catch (err) { next(err); }
    },

    // DELETE /v1/messages/:id/all (for everyone, sender only, within 1h)
    deleteForAll: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await messageService.deleteForAll(req.params.id, req.user!.userId);
            res.json({ success: true, message: 'Message deleted for everyone' });
        } catch (err) { next(err); }
    },
};
