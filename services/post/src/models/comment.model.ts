
import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
    postId: mongoose.Types.ObjectId;
    authorId: mongoose.Types.ObjectId;
    parentId?: mongoose.Types.ObjectId;  // For replies to comments
    text: string;
    mentions: mongoose.Types.ObjectId[];
    likeCount: number;
    replyCount: number;
    deletedAt?: Date;
    createdAt: Date;
}

const CommentSchema = new Schema<IComment>({
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, sparse: true, index: true },
    text: { type: String, required: true, maxlength: 1000, trim: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, sparse: true },
}, { timestamps: true, versionKey: false });

CommentSchema.index({ postId: 1, createdAt: 1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', CommentSchema);
