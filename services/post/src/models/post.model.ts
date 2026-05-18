
import mongoose, { Schema, Document } from 'mongoose';

export interface IMediaItem {
    url: string;  // CDN URL
    thumbnailUrl?: string;
    blurHash?: string;  // 26-char BlurHash placeholder
    type: 'photo' | 'video';
    width: number;
    height: number;
    durationSec?: number;  // For videos
    aspectRatio: string;  // '1:1', '4:5', '16:9'
}

export interface IModeration {
    status: 'pending' | 'clean' | 'flagged' | 'removed';
    aiScores: {
        nsfw?: number;
        violence?: number;
        text?: number;
    };
    reportCount: number;
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    removeReason?: string;
}

export interface IPost extends Document {
    _id: mongoose.Types.ObjectId;
    authorId: mongoose.Types.ObjectId;
    tripId?: mongoose.Types.ObjectId;   // Optional — links to trip timeline
    waypointIndex?: number;                   // Which trip waypoint
    type: 'post' | 'reel' | 'story' | 'trip_log';
    media: IMediaItem[];
    caption: string;
    hashtags: string[];
    mentions: mongoose.Types.ObjectId[];
    location?: {
        type: 'Point';
        coordinates: [number, number];          // [lng, lat]
    };
    locationLabel?: string;
    placeId?: string;
    taggedVendors: mongoose.Types.ObjectId[];
    taggedUsers: mongoose.Types.ObjectId[];
    // Engagement counters — denormalized for O(1) reads
    likeCount: number;
    commentCount: number;
    saveCount: number;
    shareCount: number;
    viewCount: number;
    engagementScore: number;  // ML-computed, recomputed q/15min
    // Author preferences
    hideLikeCount: boolean;
    commentsDisabled: boolean;
    isSponsored: boolean;
    // Lifecycle
    expiresAt?: Date;       // Stories only: now + 24h
    deletedAt?: Date;       // Soft delete — trip log integrity
    moderation: IModeration;
    createdAt: Date;
    updatedAt: Date;
}

const MediaItemSchema = new Schema({
    url: { type: String, required: true },
    thumbnailUrl: String,
    blurHash: String,
    type: { type: String, enum: ['photo', 'video'], required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    durationSec: Number,
    aspectRatio: { type: String, default: '1:1' },
}, { _id: false });

const PostSchema = new Schema<IPost>({
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', sparse: true, index: true },
    waypointIndex: Number,
    type: { type: String, enum: ['post', 'reel', 'story', 'trip_log'], default: 'post', index: true },
    media: { type: [MediaItemSchema], validate: [(v: any[]) => v.length <= 10, 'Max 10 media items'] },
    caption: { type: String, default: '', maxlength: 2200 },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    location: {
        type: { type: String, enum: ['Point'] },
        coordinates: { type: [Number] },
    },
    locationLabel: String,
    placeId: String,
    taggedVendors: [{ type: Schema.Types.ObjectId }],
    taggedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    saveCount: { type: Number, default: 0, min: 0 },
    shareCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    engagementScore: { type: Number, default: 0, index: true },
    hideLikeCount: { type: Boolean, default: false },
    commentsDisabled: { type: Boolean, default: false },
    isSponsored: { type: Boolean, default: false },
    expiresAt: { type: Date, sparse: true },
    deletedAt: { type: Date, sparse: true },
    moderation: {
        status: { type: String, enum: ['pending', 'clean', 'flagged', 'removed'], default: 'pending' },
        aiScores: { nsfw: Number, violence: Number, text: Number },
        reportCount: { type: Number, default: 0 },
        reviewedBy: Schema.Types.ObjectId,
        reviewedAt: Date,
        removeReason: String,
    },
}, { timestamps: true, versionKey: false });

// ── INDEXES ──────────────────────────────────────────────────
PostSchema.index({ 'location': '2dsphere' });
PostSchema.index({ authorId: 1, createdAt: -1 });
PostSchema.index({ tripId: 1, createdAt: 1 });  // Trip timeline
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ engagementScore: -1, createdAt: -1 });
PostSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true }); // Stories TTL
PostSchema.index({ 'moderation.status': 1 });

export const Post = mongoose.model<IPost>('Post', PostSchema);
