import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
    vendor_id: string;
    booking_id: string;
    user_id: string;
    rating: number;   // 1–5
    text?: string;
    media_urls: string[];
    helpful_count: number;
    is_verified: boolean;  // true = user has confirmed booking
    reply?: { text: string; replied_at: Date };
    created_at: Date;
}

const ReviewSchema = new Schema<IReview>({
    vendor_id: { type: String, required: true, index: true },
    booking_id: { type: String, required: true, unique: true },  // one review per booking
    user_id: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, maxlength: 1000 },
    media_urls: [String],
    helpful_count: { type: Number, default: 0 },
    is_verified: { type: Boolean, default: false },
    reply: { text: String, replied_at: Date },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

ReviewSchema.index({ vendor_id: 1, created_at: -1 });

export const ReviewModel = mongoose.model<IReview>('Review', ReviewSchema);
