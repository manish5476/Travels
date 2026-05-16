import mongoose, { Schema, Document } from 'mongoose';

// Audit log only — the actual OTP hash lives in Redis, not here.
// This records every OTP send for compliance and fraud detection.
export interface IOtpRecord extends Document {
    phone: string;
    purpose: 'login' | 'register' | 'verify_phone' | 'password_reset';
    ipAddress: string;
    userAgent: string;
    verified: boolean;
    createdAt: Date;
}

const OtpRecordSchema = new Schema<IOtpRecord>(
    {
        phone: { type: String, required: true, index: true },
        purpose: {
            type: String,
            enum: ['login', 'register', 'verify_phone', 'password_reset'],
            required: true,
        },
        ipAddress: { type: String, default: 'unknown' },
        userAgent: { type: String, default: 'unknown' },
        verified: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false }
);

// Auto-delete audit records after 90 days
OtpRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
OtpRecordSchema.index({ phone: 1, createdAt: -1 });

export const OtpRecord = mongoose.model<IOtpRecord>('OtpRecord', OtpRecordSchema);


// import mongoose, { Schema, Document } from 'mongoose';

// // Audit log for OTP sends — useful for compliance and fraud detection
// export interface IOtpRecord extends Document {
//     phone: string;
//     purpose: 'login' | 'register' | 'verify_phone' | 'password_reset';
//     ip: string;
//     verified: boolean;
//     createdAt: Date;
// }

// const OtpRecordSchema = new Schema<IOtpRecord>(
//     {
//         phone: { type: String, required: true, index: true },
//         purpose: { type: String, enum: ['login', 'register', 'verify_phone', 'password_reset'] },
//         ip: { type: String },
//         verified: { type: Boolean, default: false },
//     },
//     { timestamps: true }
// );

// // Auto-delete after 30 days
// OtpRecordSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

// export const OtpRecord = mongoose.model<IOtpRecord>('OtpRecord', OtpRecordSchema);