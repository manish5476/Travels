
import mongoose, { Schema, Document } from 'mongoose';

export interface ILike extends Document {
    targetId: mongoose.Types.ObjectId;  // postId or commentId
    targetType: 'post' | 'comment';
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const LikeSchema = new Schema<ILike>({
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

// Unique: a user can only like a target once
LikeSchema.index({ targetId: 1, targetType: 1, userId: 1 }, { unique: true });
LikeSchema.index({ userId: 1, createdAt: -1 });

export const Like = mongoose.model<ILike>('Like', LikeSchema);
