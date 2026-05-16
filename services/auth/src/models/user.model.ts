import mongoose, { Schema, Document, Model } from 'mongoose';
import { hashPassword, comparePassword, needsRehash } from '../utils/password';

// ── INTERFACES ───────────────────────────────────────────────
export interface IAuthProvider {
    provider: 'google' | 'apple' | 'phone';
    providerId: string;
    linkedAt: Date;
}

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    phone?: string;
    email?: string;
    passwordHash?: string;
    phoneVerified: boolean;
    emailVerified: boolean;
    authProviders: IAuthProvider[];
    accountStatus: 'active' | 'suspended' | 'banned' | 'deactivated';
    failedLoginAttempts: number;
    lockUntil?: Date;
    createdAt: Date;
    updatedAt: Date;
    // Instance methods
    comparePassword(plain: string): Promise<boolean>;
    isLocked(): boolean;
}

interface IUserModel extends Model<IUser> {
    findByPhone(phone: string): Promise<IUser | null>;
    findByEmail(email: string): Promise<IUser | null>;
    findByProvider(provider: string, providerId: string): Promise<IUser | null>;
}

// ── SCHEMA ───────────────────────────────────────────────────
const UserSchema = new Schema<IUser, IUserModel>(
    {
        phone: { type: String, unique: true, sparse: true, trim: true, index: true },
        email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

        // select: false → never returned in queries unless explicitly asked
        // with .select('+passwordHash')
        passwordHash: { type: String, select: false },

        phoneVerified: { type: Boolean, default: false },
        emailVerified: { type: Boolean, default: false },

        authProviders: [{
            _id: false,   // Don't add _id to subdocuments
            provider: { type: String, enum: ['google', 'apple', 'phone'], required: true },
            providerId: { type: String, required: true },
            linkedAt: { type: Date, default: Date.now },
        }],

        accountStatus: {
            type: String,
            enum: ['active', 'suspended', 'banned', 'deactivated'],
            default: 'active',
            index: true,
        },

        failedLoginAttempts: { type: Number, default: 0, min: 0 },
        lockUntil: { type: Date },
    },
    {
        timestamps: true,
        optimisticConcurrency: true,
    }
);

// ── PRE-SAVE HOOK ─────────────────────────────────────────────
// Auto-hash password whenever it changes
UserSchema.pre<IUser>('save', async function () {
    if (!this.isModified('passwordHash') || !this.passwordHash) return;

    // passwordHash field temporarily holds the plain text here
    // (set by auth.service.ts before calling user.save())
    this.passwordHash = await hashPassword(this.passwordHash);
});

// ── INSTANCE METHODS ─────────────────────────────────────────
UserSchema.methods.comparePassword = async function (
    this: IUser,
    plain: string
): Promise<boolean> {
    if (!this.passwordHash) return false;

    const match = await comparePassword(plain, this.passwordHash);

    // Silently rehash if cost factor changed
    if (match && needsRehash(this.passwordHash)) {
        this.passwordHash = plain; // pre-save hook will hash it
        await this.save();
    }

    return match;
};

UserSchema.methods.isLocked = function (this: IUser): boolean {
    return !!(this.lockUntil && this.lockUntil > new Date());
};

// ── STATIC METHODS ────────────────────────────────────────────
UserSchema.statics.findByPhone = function (phone: string) {
    return this.findOne({ phone: phone.trim() });
};

UserSchema.statics.findByEmail = function (email: string) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

UserSchema.statics.findByProvider = function (provider: string, providerId: string) {
    return this.findOne({
        authProviders: { $elemMatch: { provider, providerId } },
    });
};

// ── INDEXES ──────────────────────────────────────────────────
UserSchema.index({ 'authProviders.provider': 1, 'authProviders.providerId': 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ accountStatus: 1, createdAt: -1 });

// ── EXPORT ───────────────────────────────────────────────────
export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);



// import mongoose, { Schema, Document, Model, HydratedDocument } from 'mongoose';
// import bcrypt from 'bcrypt';

// const BCRYPT_ROUNDS = 12;

// export interface IAuthProvider {
//     provider: 'google' | 'apple' | 'phone';
//     providerId: string;
//     linkedAt: Date;
// }

// export interface IUser extends Document {
//     _id: mongoose.Types.ObjectId;
//     phone?: string;
//     email?: string;
//     passwordHash?: string;
//     phoneVerified: boolean;
//     emailVerified: boolean;
//     authProviders: IAuthProvider[];
//     accountStatus: 'active' | 'suspended' | 'banned' | 'deactivated';
//     failedLoginAttempts: number;
//     lockUntil?: Date;
//     createdAt: Date;
//     updatedAt: Date;
//     // Methods
//     comparePassword(plain: string): Promise<boolean>;
//     isLocked(): boolean;
// }

// interface IUserModel extends Model<IUser> {
//     findByPhone(phone: string): Promise<HydratedDocument<IUser> | null>;
//     findByEmail(email: string): Promise<HydratedDocument<IUser> | null>;
// }

// const UserSchema = new Schema<IUser, IUserModel>(
//     {
//         phone: { type: String, unique: true, sparse: true, index: true },
//         email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
//         passwordHash: { type: String, select: false },  // Never returned by default
//         phoneVerified: { type: Boolean, default: false },
//         emailVerified: { type: Boolean, default: false },
//         authProviders: [{
//             provider: { type: String, enum: ['google', 'apple', 'phone'], required: true },
//             providerId: { type: String, required: true },
//             linkedAt: { type: Date, default: Date.now },
//         }],
//         accountStatus: {
//             type: String,
//             enum: ['active', 'suspended', 'banned', 'deactivated'],
//             default: 'active',
//             index: true,
//         },
//         failedLoginAttempts: { type: Number, default: 0 }, lockUntil: { type: Date },
//     },
//     { timestamps: true }
// );

// // ── PRE-SAVE: Hash password before storing ──────────────────
// UserSchema.pre('save', async function () {
//     if (!this.isModified('passwordHash') || !this.passwordHash) return;
//     this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
// });

// // ── INSTANCE METHOD: Compare password ───────────────────────
// UserSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
//     if (!this.passwordHash) return Promise.resolve(false);
//     return bcrypt.compare(plain, this.passwordHash);
// };

// // ── INSTANCE METHOD: Check if account is locked ─────────────
// UserSchema.methods.isLocked = function (): boolean {
//     return !!(this.lockUntil && this.lockUntil > new Date());
// };

// // ── STATIC METHODS ──────────────────────────────────────────
// UserSchema.statics.findByPhone = function (phone: string) {
//     return this.findOne({ phone });
// };
// UserSchema.statics.findByEmail = function (email: string) {
//     return this.findOne({ email: email.toLowerCase() });
// };

// // ── INDEXES ─────────────────────────────────────────────────
// UserSchema.index({ 'authProviders.provider': 1, 'authProviders.providerId': 1 });
// UserSchema.index({ createdAt: -1 });

// export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);