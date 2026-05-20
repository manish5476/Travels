
import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant {
    userId: mongoose.Types.ObjectId;
    joinedAt: Date;
    lastReadAt?: Date;      // Last time this user read messages
    unreadCount: number;    // Denormalized for fast inbox rendering
    isAdmin: boolean;   // For group conversations
}

export interface ILastMessage {
    messageId: mongoose.Types.ObjectId;
    contentPreview: string;  // First 100 chars — shown in inbox list
    senderId: mongoose.Types.ObjectId;
    sentAt: Date;
    type: string;
}

export interface IConversation extends Document {
    _id: mongoose.Types.ObjectId;
    type: 'direct' | 'group' | 'trip_group';
    // For group / trip_group
    name?: string;
    avatarUrl?: string;
    // Link to trip (for trip_group type)
    tripId?: mongoose.Types.ObjectId;
    participants: IParticipant[];
    lastMessage?: ILastMessage;
    // For group: who can send messages
    messagePolicy: 'all' | 'admins_only';
    isArchived: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>({
    type: { type: String, enum: ['direct', 'group', 'trip_group'], required: true, index: true },
    name: { type: String, maxlength: 100 },
    avatarUrl: String,
    tripId: { type: Schema.Types.ObjectId, sparse: true, index: true },
    participants: [{
        _id: false,
        userId: { type: Schema.Types.ObjectId, required: true },
        joinedAt: { type: Date, default: Date.now },
        lastReadAt: Date,
        unreadCount: { type: Number, default: 0, min: 0 },
        isAdmin: { type: Boolean, default: false },
    }],
    lastMessage: {
        _id: false,
        messageId: Schema.Types.ObjectId,
        contentPreview: String,
        senderId: Schema.Types.ObjectId,
        sentAt: Date,
        type: String,
    },
    messagePolicy: { type: String, enum: ['all', 'admins_only'], default: 'all' },
    isArchived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true, versionKey: false });

// Fast lookup: all conversations for a user
ConversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });
// Unique direct conversation between two users
ConversationSchema.index({ type: 1, 'participants.userId': 1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
