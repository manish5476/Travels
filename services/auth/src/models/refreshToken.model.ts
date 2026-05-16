import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
    token: string;   // UUID v4 — stored as the actual token value
    userId: mongoose.Types.ObjectId;
    deviceId: string;   // Which device/client issued this
    family: string;   // UUID — all tokens in one rotation chain share a family.
    // On reuse detection: revoke entire family.
    revoked: boolean;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
    {
        token: { type: String, required: true, unique: true, index: true },
        userId: { type: Schema.Types.ObjectId, required: true, index: true },
        deviceId: { type: String, required: true, default: 'default' },
        family: { type: String, required: true, index: true },
        revoked: { type: Boolean, default: false, index: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true, versionKey: false }
);

// TTL index: MongoDB auto-deletes documents after expiresAt
// No cron job needed to clean up expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookup by userId + revoked status
RefreshTokenSchema.index({ userId: 1, revoked: 1 });

export const RefreshToken = mongoose.model<IRefreshToken>(
    'RefreshToken',
    RefreshTokenSchema
);







// import mongoose, { Schema, Document } from 'mongoose';

// export interface IRefreshToken extends Document {
//     token: string;   // The actual UUID token
//     userId: mongoose.Types.ObjectId;
//     deviceId: string;   // Track which device issued this token
//     family: string;   // UUID — all tokens in a rotation chain share a family
//     revoked: boolean;
//     expiresAt: Date;
//     createdAt: Date;
// }

// const RefreshTokenSchema = new Schema<IRefreshToken>(
//     {
//         token: { type: String, required: true, unique: true, index: true },
//         userId: { type: Schema.Types.ObjectId, required: true, index: true },
//         deviceId: { type: String, required: true },
//         family: { type: String, required: true, index: true },
//         revoked: { type: Boolean, default: false, index: true }, expiresAt: { type: Date, required: true },
//     },
//     { timestamps: true }
// );

// // TTL index: MongoDB auto-deletes expired tokens
// // Keeps the collection clean without a cron job
// RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
