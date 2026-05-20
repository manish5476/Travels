
import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { messageController } from '../controllers/message.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateBody } from '../validators/messaging.validator';

export const messagingRoutes = Router();

// All messaging routes require authentication
messagingRoutes.use(authMiddleware);

// ── CONVERSATIONS ─────────────────────────────────────────
messagingRoutes.post('/conversations', validateBody('createConversation'), conversationController.create);
messagingRoutes.get('/conversations', conversationController.list);
messagingRoutes.get('/conversations/:id', conversationController.getById);

// ── MESSAGES ──────────────────────────────────────────────
messagingRoutes.get('/conversations/:id/messages', messageController.getHistory);

// Message deletion (REST — not WebSocket)
messagingRoutes.delete('/messages/:id', messageController.deleteForMe);
messagingRoutes.delete('/messages/:id/all', messageController.deleteForAll);
