
import { Request, Response, NextFunction } from 'express';
import { conversationService } from '../services/conversation.service';
import { presenceService } from '../services/presence.service';

export const conversationController = {

    // POST /v1/messages/conversations
    create: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { type, participantId, participantIds, name } = req.body;
            const userId = req.user!.userId;
            let conversation;

            if (type === 'direct') {
                conversation = await conversationService.createDirect(userId, participantId);
            } else {
                conversation = await conversationService.createGroup(userId, name, participantIds);
            }
            res.status(201).json({ success: true, data: conversation });
        } catch (err) { next(err); }
    },

    // GET /v1/messages/conversations
    list: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { cursor, limit } = req.query as { cursor?: string; limit?: string };
            const result = await conversationService.getUserConversations(
                req.user!.userId, cursor, limit ? parseInt(limit) : 20
            );
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // GET /v1/messages/conversations/:id
    getById: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const conv = await conversationService.getById(req.params.id, req.user!.userId);

            // Enrich with online status of participants
            const participantIds = conv.participants.map(p => p.userId.toString());
            const onlineStatus = await presenceService.getOnlineStatus(participantIds);

            res.json({ success: true, data: { ...conv.toObject(), onlineStatus } });
        } catch (err) { next(err); }
    },
};
