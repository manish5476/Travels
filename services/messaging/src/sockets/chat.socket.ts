
import { Server, Socket } from 'socket.io';
import { messageService } from '../services/message.service';
import { conversationService } from '../services/conversation.service';
import { readReceiptService } from '../services/readReceipt.service';
import { presenceService } from '../services/presence.service';
import { typingService } from '../services/typingIndicator.service';
import { Rooms, ClientEvents, ServerEvents } from './rooms';
import { logger } from '../utils/logger';
import { config } from '../config';

export function registerChatHandlers(io: Server, socket: Socket): void {
    const userId = socket.data.userId as string;

    // ── ON CONNECT ───────────────────────────────────────────
    // 1. Join personal notification room
    socket.join(Rooms.user(userId));
    // 2. Mark user online in Redis
    presenceService.setOnline(userId).catch(() => { });
    // 3. Broadcast online status to all rooms this socket is in
    socket.broadcast.emit(ServerEvents.PRESENCE_UPDATE, { userId, isOnline: true });

    logger.info({ userId, socketId: socket.id }, 'Socket connected');

    // ── HEARTBEAT ────────────────────────────────────────────
    // Refresh Redis presence TTL every 15 seconds.
    // If socket disconnects without clean disconnect, TTL expires naturally.
    const heartbeat = setInterval(() => {
        presenceService.refresh(userId).catch(() => { });
    }, config.limits.heartbeatInterval);

    // ── JOIN CONVERSATION ────────────────────────────────────
    socket.on(ClientEvents.JOIN_CONVERSATION, async (conversationId: string) => {
        try {
            // Security: verify user is actually a participant before joining room
            const isMember = await conversationService.isParticipant(conversationId, userId);
            if (!isMember) {
                socket.emit(ServerEvents.ERROR, { code: 'NOT_A_PARTICIPANT' });
                return;
            }
            socket.join(Rooms.conversation(conversationId));
            socket.emit('join:conversation:ok', { conversationId });

            // Reset unread count when user joins (opens the conversation)
            await readReceiptService.resetUnread(conversationId, userId);
        } catch (err) {
            logger.error({ err, userId, conversationId }, 'join:conversation failed');
            socket.emit(ServerEvents.ERROR, { code: 'JOIN_FAILED' });
        }
    });

    // ── LEAVE CONVERSATION ───────────────────────────────────
    socket.on(ClientEvents.LEAVE_CONVERSATION, (conversationId: string) => {
        socket.leave(Rooms.conversation(conversationId));
    });

    // ── SEND MESSAGE ─────────────────────────────────────────
    socket.on(ClientEvents.SEND_MESSAGE, async (data: {
        tempId: string;    // Client-generated temp ID for optimistic UI
        conversationId: string;
        type: string;
        content?: string;
        mediaUrl?: string;
        mediaDuration?: number;
        location?: { lat: number; lng: number; label?: string };
        sharedPostId?: string;
        replyToId?: string;
    }) => {
        try {
            // Input validation
            if (data.type === 'text' && (!data.content || data.content.trim().length === 0)) {
                socket.emit(ServerEvents.ERROR, { tempId: data.tempId, code: 'EMPTY_MESSAGE' });
                return;
            }
            if (data.content && data.content.length > config.limits.maxMessageLength) {
                socket.emit(ServerEvents.ERROR, { tempId: data.tempId, code: 'MESSAGE_TOO_LONG' });
                return;
            }

            const message = await messageService.create({
                conversationId: data.conversationId,
                senderId: userId,
                type: data.type as any,
                content: data.content,
                mediaUrl: data.mediaUrl,
                mediaDuration: data.mediaDuration,
                location: data.location,
                sharedPostId: data.sharedPostId,
                replyToId: data.replyToId,
            });

            // Broadcast to ALL members in the conversation room
            // Including the sender (for multi-device sync)
            io.to(Rooms.conversation(data.conversationId)).emit(ServerEvents.MESSAGE_NEW, {
                ...message.toObject(),
                tempId: data.tempId, // Client uses this to replace optimistic message
            });

            // Auto-stop typing indicator when message is sent
            await typingService.stopTyping(data.conversationId, userId);
            socket.to(Rooms.conversation(data.conversationId)).emit(ServerEvents.TYPING_UPDATE, {
                userId, conversationId: data.conversationId, isTyping: false,
            });

        } catch (err) {
            logger.error({ err, userId }, 'message:send failed');
            socket.emit(ServerEvents.ERROR, { tempId: data.tempId, code: 'SEND_FAILED' });
        }
    });

    // ── TYPING START ─────────────────────────────────────────
    socket.on(ClientEvents.TYPING_START, async ({ conversationId }: { conversationId: string }) => {
        // isNew = false if already broadcasting (TTL refresh only — no re-broadcast)
        const isNew = await typingService.startTyping(conversationId, userId);
        if (isNew) {
            // Broadcast ONLY to others (not back to sender)
            socket.to(Rooms.conversation(conversationId)).emit(ServerEvents.TYPING_UPDATE, {
                userId, conversationId, isTyping: true,
            });
        }
    });

    // ── TYPING STOP ──────────────────────────────────────────
    socket.on(ClientEvents.TYPING_STOP, async ({ conversationId }: { conversationId: string }) => {
        await typingService.stopTyping(conversationId, userId);
        socket.to(Rooms.conversation(conversationId)).emit(ServerEvents.TYPING_UPDATE, {
            userId, conversationId, isTyping: false,
        });
    });

    // ── MARK MESSAGES AS READ ────────────────────────────────
    socket.on(ClientEvents.MARK_READ, async ({ messageIds, conversationId }: {
        messageIds: string[]; conversationId: string;
    }) => {
        try {
            // Batched: client sends after 100ms debounce to reduce DB writes
            await readReceiptService.markRead(messageIds, userId);
            await readReceiptService.resetUnread(conversationId, userId);

            // Notify others in the conversation that these messages were read
            socket.to(Rooms.conversation(conversationId)).emit(ServerEvents.READ_UPDATE, {
                messageIds, userId, readAt: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err, userId }, 'messages:read failed');
        }
    });

    // ── MARK DELIVERED ───────────────────────────────────────
    socket.on(ClientEvents.MARK_DELIVERED, async ({ messageIds, conversationId }: {
        messageIds: string[]; conversationId: string;
    }) => {
        try {
            await readReceiptService.markDelivered(messageIds, userId);
            socket.to(Rooms.conversation(conversationId)).emit(ServerEvents.DELIVERED_UPDATE, {
                messageIds, userId,
            });
        } catch (err) {
            logger.warn({ err }, 'messages:delivered failed — non-fatal');
        }
    });

    // ── REACT TO MESSAGE ─────────────────────────────────────
    socket.on(ClientEvents.REACT_MESSAGE, async ({ messageId, conversationId, emoji }: {
        messageId: string; conversationId: string; emoji: string;
    }) => {
        try {
            await messageService.react(messageId, userId, emoji);
            io.to(Rooms.conversation(conversationId)).emit(ServerEvents.REACTION_UPDATE, {
                messageId, userId, emoji,
            });
        } catch (err) {
            logger.error({ err, userId }, 'message:react failed');
        }
    });

    // ── JOIN TRIP ROOM ────────────────────────────────────────
    // Allows receiving trip events (state changes, waypoint check-ins, etc.)
    socket.on(ClientEvents.JOIN_TRIP, (tripId: string) => {
        socket.join(Rooms.trip(tripId));
    });

    // ── DISCONNECT ───────────────────────────────────────────
    socket.on('disconnect', async (reason) => {
        clearInterval(heartbeat);
        await presenceService.setOffline(userId);

        // Broadcast offline status to all rooms this user was in
        socket.broadcast.emit(ServerEvents.PRESENCE_UPDATE, { userId, isOnline: false });

        logger.info({ userId, socketId: socket.id, reason }, 'Socket disconnected');
    });
}
