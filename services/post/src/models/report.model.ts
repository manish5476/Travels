
import mongoose, { Schema, Document } from 'mongoose';

export type ReportReason =
    | 'spam' | 'nudity' | 'violence' | 'hate_speech'
    | 'harassment' | 'false_info' | 'scam' | 'other';

export interface IReport extends Document {
    postId: mongoose.Types.ObjectId;
    reporterId: mongoose.Types.ObjectId;
    reason: ReportReason;
    description?: string;
    status: 'pending' | 'reviewed' | 'dismissed';
    createdAt: Date;
}

const ReportSchema = new Schema<IReport>({
    postId: { type: Schema.Types.ObjectId, required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: ['spam', 'nudity', 'violence', 'hate_speech', 'harassment', 'false_info', 'scam', 'other'], required: true },
    description: { type: String, maxlength: 500 },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending', index: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

// One report per user per post
ReportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
