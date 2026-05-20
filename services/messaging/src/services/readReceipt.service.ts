
import mongoose from 'mongoose';
import { Message } from '../models/message.model';
import { Conversation } from '../models/conversation.model';

export const readReceiptService = {

    // ── MARK MESSAGES AS READ ─────────────────────────────────
    // Called when user opens a conversation or scrolls to see messages.
    // Bulk operation: mark multiple messages at once.
    async markRead(messageIds: string[], userId: string): Promise<void> {
        if (messageIds.length === 0) return;

        const now = new Date();
        const uid = new mongoose.Types.ObjectId(userId);

        // Bulk update: add readBy entry to all messages not already read by this user
        await Message.updateMany(
            {
                _id: { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) },
                'readBy.userId': { $ne: uid },
                senderId: { $ne: uid }, // Don't mark own messages as read
            },
            { $push: { readBy: { userId: uid, readAt: now } } }
        );
    },

    // ── RESET UNREAD COUNT ────────────────────────────────────
    // Called when user opens a conversation — resets their unread counter.
    async resetUnread(conversationId: string, userId: string): Promise<void> {
        await Conversation.updateOne(
            { _id: conversationId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
            {
                $set: {
                    'participants.$.unreadCount': 0,
                    'participants.$.lastReadAt': new Date(),
                },
            }
        );
    },

    // ── MARK DELIVERED ────────────────────────────────────────
    // Called when a message reaches a user's device (not necessarily read).
    async markDelivered(messageIds: string[], userId: string): Promise<void> {
        const uid = new mongoose.Types.ObjectId(userId);
        await Message.updateMany(
            { _id: { $in: messageIds.map(id => new mongoose.Types.ObjectId(id)) } },
            { $addToSet: { deliveredTo: uid } }
        );
    },
};
