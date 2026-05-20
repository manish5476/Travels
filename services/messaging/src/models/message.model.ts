
import mongoose, { Schema, Document } from 'mongoose';

export type MessageType =
    | 'text' | 'image' | 'video' | 'voice'
    | 'location_pin' | 'post_share' | 'trip_invite' | 'system';

export interface IReaction {
    userId: mongoose.Types.ObjectId;
    emoji: string;
}

export interface IReadReceipt {
    userId: mongoose.Types.ObjectId;
    readAt: Date;
}

export interface IMessage extends Document {
    _id: mongoose.Types.ObjectId;
    conversationId: mongoose.Types.ObjectId;
    senderId: mongoose.Types.ObjectId;
    type: MessageType;
    // Content (varies by type)
    content?: string;          // For 'text'
    mediaUrl?: string;          // For image/video/voice
    mediaDuration?: number;          // For voice (seconds)
    location?: { lat: number; lng: number; label?: string }; // For location_pin
    sharedPostId?: mongoose.Types.ObjectId; // For post_share
    tripInviteId?: mongoose.Types.ObjectId; // For trip_invite
    systemText?: string;          // For system messages
    // Reply threading
    replyToId?: mongoose.Types.ObjectId;
    replyPreview?: string;          // Cached preview of replied message
    // Engagement
    reactions: IReaction[];
    // Delivery tracking
    readBy: IReadReceipt[];
    deliveredTo: mongoose.Types.ObjectId[];
    // Soft delete per user
    deletedFor: mongoose.Types.ObjectId[];
    // Edit tracking
    editedAt?: Date;
    originalContent?: string;
    createdAt: Date;
}

const MessageSchema = new Schema<IMessage>({
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ['text', 'image', 'video', 'voice', 'location_pin', 'post_share', 'trip_invite', 'system'], required: true },
    content: { type: String, maxlength: 4000 },
    mediaUrl: String,
    mediaDuration: Number,
    location: { lat: Number, lng: Number, label: String },
    sharedPostId: Schema.Types.ObjectId,
    tripInviteId: Schema.Types.ObjectId,
    systemText: String,
    replyToId: { type: Schema.Types.ObjectId, sparse: true },
    replyPreview: String,
    reactions: [{ _id: false, userId: Schema.Types.ObjectId, emoji: String }],
    readBy: [{ _id: false, userId: Schema.Types.ObjectId, readAt: Date }],
    deliveredTo: [{ type: Schema.Types.ObjectId }],
    deletedFor: [{ type: Schema.Types.ObjectId }],
    editedAt: Date,
    originalContent: String,
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

// Primary query: messages in a conversation, newest first
MessageSchema.index({ conversationId: 1, createdAt: -1 });
// Reply lookup
MessageSchema.index({ replyToId: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
