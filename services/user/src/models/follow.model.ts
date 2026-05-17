import mongoose, { Schema, Document } from 'mongoose';

export interface IFollow extends Document {
    followerId: mongoose.Types.ObjectId;  // The user who is following
    followingId: mongoose.Types.ObjectId; // The user being followed
    createdAt: Date;
}

const FollowSchema = new Schema<IFollow>(
    {
        followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        followingId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true, versionKey: false }
);

// Unique: a user can only follow another user once
FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Fast lookup: who follows userId?
FollowSchema.index({ followingId: 1, createdAt: -1 });

// Fast lookup: who does userId follow?
FollowSchema.index({ followerId: 1, createdAt: -1 });

export const Follow = mongoose.model<IFollow>('Follow', FollowSchema);