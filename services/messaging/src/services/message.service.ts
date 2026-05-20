import mongoose from 'mongoose';
import { Message, IMessage, MessageType } from '../models/message.model';
import { conversationService } from './conversation.service';
import { logger } from '../utils/logger';

export interface CreateMessageDTO {
    conversationId: string;
    senderId: string;
    type: MessageType;
    content?: string;
    mediaUrl?: string;
    mediaDuration?: number;
    location?: { lat: number; lng: number; label?: string };
    sharedPostId?: string;
    tripInviteId?: string;
    replyToId?: string;
}

export const messageService = {

    // ── CREATE MESSAGE ────────────────────────────────────────
    async create(dto: CreateMessageDTO): Promise<IMessage> {
        // Verify sender is a participant
        const isMember = await conversationService.isParticipant(dto.conversationId, dto.senderId);
        if (!isMember) throw new Error('NOT_A_PARTICIPANT');

        // If replying, fetch preview of parent message
        let replyPreview: string | undefined;
        if (dto.replyToId) {
            const parent = await Message.findById(dto.replyToId).select('content type').lean();
            replyPreview = parent?.content?.slice(0, 100) || parent?.type;
        }

        const message = await Message.create({
            conversationId: new mongoose.Types.ObjectId(dto.conversationId),
            senderId: new mongoose.Types.ObjectId(dto.senderId),
            type: dto.type,
            content: dto.content?.trim(),
            mediaUrl: dto.mediaUrl,
            mediaDuration: dto.mediaDuration,
            location: dto.location,
            sharedPostId: dto.sharedPostId ? new mongoose.Types.ObjectId(dto.sharedPostId) : undefined,
            tripInviteId: dto.tripInviteId ? new mongoose.Types.ObjectId(dto.tripInviteId) : undefined,
            replyToId: dto.replyToId ? new mongoose.Types.ObjectId(dto.replyToId) : undefined,
            replyPreview,
            reactions: [],
            readBy: [],
            deliveredTo: [new mongoose.Types.ObjectId(dto.senderId)], // Sender auto-delivered
            deletedFor: [],
        });

        // Update conversation last message + unread counts (async)
        conversationService.updateLastMessage(dto.conversationId, message)
            .catch(err => logger.error({ err }, 'Failed to update last message'));

        return message;
    },

    // ── GET MESSAGES (paginated) ──────────────────────────────
    async getForConversation(conversationId: string, userId: string, cursor?: string, limit = 40) {
        // Verify access
        const isMember = await conversationService.isParticipant(conversationId, userId);
        if (!isMember) throw new Error('NOT_A_PARTICIPANT');

        const query: any = {
            conversationId: new mongoose.Types.ObjectId(conversationId),
            deletedFor: { $ne: new mongoose.Types.ObjectId(userId) },
        };
        // Cursor: load messages older than cursor (scroll up = older messages)
        if (cursor) query.createdAt = { $lt: new Date(cursor) };

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })  // Newest first
            .limit(limit + 1)
            .lean();

        const hasMore = messages.length > limit;
        const items = hasMore ? messages.slice(0, limit) : messages;
        const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

        return { messages: items.reverse(), nextCursor }; // Return oldest first for display
    },

    // ── SOFT DELETE FOR USER ──────────────────────────────────
    async deleteForUser(messageId: string, userId: string): Promise<void> {
        const message = await Message.findById(messageId);
        if (!message) throw new Error('MESSAGE_NOT_FOUND');

        // Anyone can delete for themselves. Only sender can delete for all.
        await Message.updateOne(
            { _id: messageId },
            { $addToSet: { deletedFor: new mongoose.Types.ObjectId(userId) } }
        );
    },

    // ── DELETE FOR ALL (sender only, within 1 hour) ───────────
    async deleteForAll(messageId: string, senderId: string): Promise<void> {
        const message = await Message.findById(messageId);
        if (!message) throw new Error('MESSAGE_NOT_FOUND');
        if (message.senderId.toString() !== senderId) throw new Error('FORBIDDEN');

        const ageMs = Date.now() - message.createdAt.getTime();
        if (ageMs > 60 * 60 * 1000) throw new Error('DELETE_WINDOW_EXPIRED');

        await Message.updateOne({ _id: messageId }, {
            content: '[This message was deleted]',
            type: 'system',
            systemText: '[This message was deleted]',
            mediaUrl: undefined,
        });
    },

    // ── REACT TO MESSAGE ──────────────────────────────────────
    async react(messageId: string, userId: string, emoji: string): Promise<void> {
        const uid = new mongoose.Types.ObjectId(userId);
        // Remove any existing reaction from this user first (one reaction per user)
        await Message.updateOne({ _id: messageId }, { $pull: { reactions: { userId: uid } } });
        // Add new reaction
        await Message.updateOne({ _id: messageId }, { $push: { reactions: { userId: uid, emoji } } });
    },

    // ── CREATE SYSTEM MESSAGE ─────────────────────────────────
    // Used for trip events: 'Rahul joined the trip', 'Trip is now active', etc.
    async createSystemMessage(conversationId: string, text: string): Promise<IMessage> {
        return Message.create({
            conversationId: new mongoose.Types.ObjectId(conversationId),
            senderId: new mongoose.Types.ObjectId('000000000000000000000000'), // System user
            type: 'system',
            systemText: text,
            reactions: [], readBy: [], deliveredTo: [], deletedFor: [],
        });
    },
};
