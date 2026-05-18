
import mongoose, { Schema, Document } from 'mongoose';

export interface ISave extends Document {
    postId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const SaveSchema = new Schema<ISave>({
    postId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

SaveSchema.index({ postId: 1, userId: 1 }, { unique: true });
SaveSchema.index({ userId: 1, createdAt: -1 });

export const Save = mongoose.model<ISave>('Save', SaveSchema);
