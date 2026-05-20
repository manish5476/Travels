
import mongoose from 'mongoose';
import { Conversation, IConversation } from '../models/conversation.model';
import { logger } from '../utils/logger';

export const conversationService = {

    // ── CREATE DIRECT (1-on-1) ───────────────────────────────
    // Idempotent: returns existing conversation if already exists
    async createDirect(userAId: string, userBId: string): Promise<IConversation> {
        // Check if direct conversation already exists between these two users
        const existing = await Conversation.findOne({
            type: 'direct',
            'participants.userId': {
                $all: [
                    new mongoose.Types.ObjectId(userAId),
                    new mongoose.Types.ObjectId(userBId),
                ]
            },
        });
        if (existing) return existing;

        const conversation = await Conversation.create({
            type: 'direct',
            createdBy: new mongoose.Types.ObjectId(userAId),
            participants: [
                { userId: new mongoose.Types.ObjectId(userAId), isAdmin: false, unreadCount: 0 },
                { userId: new mongoose.Types.ObjectId(userBId), isAdmin: false, unreadCount: 0 },
            ],
        });

        logger.info({ conversationId: conversation._id, userAId, userBId }, 'Direct conversation created');
        return conversation;
    },

    // ── CREATE GROUP ─────────────────────────────────────────
    async createGroup(creatorId: string, name: string, participantIds: string[]): Promise<IConversation> {
        const allIds = [...new Set([creatorId, ...participantIds])];

        const conversation = await Conversation.create({
            type: 'group',
            name,
            createdBy: new mongoose.Types.ObjectId(creatorId),
            participants: allIds.map(id => ({
                userId: new mongoose.Types.ObjectId(id),
                isAdmin: id === creatorId,
                unreadCount: 0,
            })),
        });

        logger.info({ conversationId: conversation._id, creatorId, size: allIds.length }, 'Group conversation created');
        return conversation;
    },

    // ── CREATE TRIP GROUP (auto-called when trip transitions to PLANNING) ─
    async createTripGroup(tripId: string, tripTitle: string, adminId: string, memberIds: string[]): Promise<IConversation> {
        // Check if trip group already exists
        const existing = await Conversation.findOne({ tripId: new mongoose.Types.ObjectId(tripId) });
        if (existing) return existing;

        const allIds = [...new Set([adminId, ...memberIds])];
        const conversation = await Conversation.create({
            type: 'trip_group',
            name: `${tripTitle} — Group`,
            tripId: new mongoose.Types.ObjectId(tripId),
            createdBy: new mongoose.Types.ObjectId(adminId),
            participants: allIds.map(id => ({
                userId: new mongoose.Types.ObjectId(id),
                isAdmin: id === adminId,
                unreadCount: 0,
            })),
        });

        logger.info({ conversationId: conversation._id, tripId }, 'Trip group conversation created');
        return conversation;
    },

    // ── GET USER CONVERSATIONS (inbox) ───────────────────────
    async getUserConversations(userId: string, cursor?: string, limit = 20): Promise<{ conversations: (mongoose.FlattenMaps<IConversation> & { _id: mongoose.Types.ObjectId } & { myUnreadCount: number })[]; nextCursor: string | null }> {
        const query: any = {
            'participants.userId': new mongoose.Types.ObjectId(userId),
            isArchived: false,
        };
        if (cursor) query.updatedAt = { $lt: new Date(cursor) };

        const conversations = await Conversation.find(query)
            .sort({ updatedAt: -1 })
            .limit(limit + 1)
            .lean();

        const hasMore = conversations.length > limit;
        const items = hasMore ? conversations.slice(0, limit) : conversations;
        const nextCursor = hasMore ? items[items.length - 1].updatedAt.toISOString() : null;

        // Attach unread count for THIS user from participants array
        const enriched = items.map(c => {
            const myParticipant = c.participants.find(p => p.userId.toString() === userId);
            return { ...c, myUnreadCount: myParticipant?.unreadCount || 0 };
        });

        return { conversations: enriched, nextCursor };
    },

    // ── GET BY ID ─────────────────────────────────────────────
    async getById(conversationId: string, userId: string): Promise<IConversation> {
        const conv = await Conversation.findById(conversationId);
        if (!conv) throw new Error('CONVERSATION_NOT_FOUND');

        const isMember = conv.participants.some(p => p.userId.toString() === userId);
        if (!isMember) throw new Error('NOT_A_PARTICIPANT');

        return conv;
    },

    // ── IS PARTICIPANT ────────────────────────────────────────
    async isParticipant(conversationId: string, userId: string): Promise<boolean> {
        const exists = await Conversation.exists({
            _id: conversationId,
            'participants.userId': new mongoose.Types.ObjectId(userId),
        });
        return !!exists;
    },

    // ── ADD PARTICIPANT ───────────────────────────────────────
    async addParticipant(conversationId: string, adminId: string, newUserId: string): Promise<void> {
        const conv = await Conversation.findById(conversationId);
        if (!conv) throw new Error('CONVERSATION_NOT_FOUND');
        if (conv.type === 'direct') throw new Error('CANNOT_ADD_TO_DIRECT');

        const isAdmin = conv.participants.some(p => p.userId.toString() === adminId && p.isAdmin);
        if (!isAdmin) throw new Error('FORBIDDEN');

        const alreadyMember = conv.participants.some(p => p.userId.toString() === newUserId);
        if (alreadyMember) return;

        await Conversation.updateOne({ _id: conversationId }, {
            $push: { participants: { userId: new mongoose.Types.ObjectId(newUserId), isAdmin: false, unreadCount: 0 } },
        });
    },

    // ── UPDATE LAST MESSAGE (called after message creation) ───
    async updateLastMessage(conversationId: string, message: {
        _id: any; content?: string; type: string; senderId: any; createdAt: Date;
    }): Promise<void> {
        const preview = message.content?.slice(0, 100) ||
            (message.type === 'image' ? '📷 Photo' :
                message.type === 'video' ? '🎥 Video' :
                    message.type === 'voice' ? '🎙️ Voice message' :
                        message.type === 'location_pin' ? '📍 Location' :
                            message.type === 'system' ? '🔔 ' : '📎 Attachment');

        await Conversation.updateOne({ _id: conversationId }, {
            lastMessage: {
                messageId: message._id,
                contentPreview: preview,
                senderId: message.senderId,
                sentAt: message.createdAt,
                type: message.type,
            },
            // Increment unread count for all participants EXCEPT sender
            $inc: { 'participants.$[notSender].unreadCount': 1 },
        }, {
            arrayFilters: [{ 'notSender.userId': { $ne: message.senderId } }],
        });
    },
};
