import mongoose, { Schema, Document, Model } from 'mongoose';

// ── NESTED TYPES ─────────────────────────────────────────────
export interface ITravelStats {
    countriesVisited: string[];
    citiesVisited: string[];
    totalKm: number;
    tripsCompleted: number;
    tripsAsAdmin: number;
}

export interface IPreferences {
    budgetStyle: 'budget' | 'mid' | 'luxury';
    interests: string[];  // ['beach','adventure','culture','food','hiking']
    homeCity: {
        type: string;
        coordinates: [number, number];  // [lng, lat]
        label: string;
    } | null;
}

export interface IPrivacySettings {
    locationSharing: 'off' | 'friends' | 'public';
    profileVisibility: 'public' | 'friends' | 'private';
    storyAudience: 'everyone' | 'followers' | 'close_friends';
    showOnlineStatus: boolean;
    showLastSeen: boolean;
}

export interface ITravelerRank {
    xp: number;
    level: 'Explorer' | 'Adventurer' | 'Voyager' | 'Legend';
    badges: string[];
    streakDays: number;
    lastActivityAt: Date | null;
}

export interface IDeviceToken {
    token: string;
    platform: 'ios' | 'android';
    lastSeen: Date;
}

// ── MAIN INTERFACE ────────────────────────────────────────────
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    // Auth link — same _id as Auth Service user document
    username: string;
    displayName: string;
    bio: string;
    website?: string;
    avatarUrl?: string;       // CDN URL (150x150)
    avatarFullUrl?: string;      // CDN URL (400x400)
    phone?: string;       // Synced from Auth (for display only)
    email?: string;       // Synced from Auth (for display only)
    // Counters — denormalized for O(1) reads
    followerCount: number;
    followingCount: number;
    postCount: number;
    tripCount: number;
    // Rich profile data
    travelStats: ITravelStats;
    preferences: IPreferences;
    privacySettings: IPrivacySettings;
    travelerRank: ITravelerRank;
    // Device tokens for push notifications
    deviceTokens: IDeviceToken[];
    // Block list — stored as array, max 500
    blockedUsers: mongoose.Types.ObjectId[];
    // Account state
    isVendor: boolean;
    accountStatus: 'active' | 'suspended' | 'deactivated' | 'banned';
    lastActiveAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

interface IUserModel extends Model<IUser> {
    findByUsername(username: string): Promise<IUser | null>;
}

// ── SCHEMA ───────────────────────────────────────────────────
const UserSchema = new Schema<IUser, IUserModel>(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^[a-z0-9_.]{3,30}$/, 'Username: 3-30 chars, letters/numbers/._'],
        },
        displayName: { type: String, required: true, trim: true, maxlength: 60 },
        bio: { type: String, default: '', maxlength: 160 },
        website: { type: String, trim: true, maxlength: 100 },
        avatarUrl: { type: String },
        avatarFullUrl: { type: String },
        phone: { type: String },
        email: { type: String, lowercase: true },

        // Denormalized counters — always use $inc for atomicity
        followerCount: { type: Number, default: 0, min: 0 },
        followingCount: { type: Number, default: 0, min: 0 },
        postCount: { type: Number, default: 0, min: 0 },
        tripCount: { type: Number, default: 0, min: 0 },

        travelStats: {
            _id: false,
            countriesVisited: { type: [String], default: [] },
            citiesVisited: { type: [String], default: [] },
            totalKm: { type: Number, default: 0 },
            tripsCompleted: { type: Number, default: 0 },
            tripsAsAdmin: { type: Number, default: 0 },
        },

        preferences: {
            _id: false,
            budgetStyle: { type: String, enum: ['budget', 'mid', 'luxury'], default: 'mid' },
            interests: { type: [String], default: [] },
            homeCity: { type: Schema.Types.Mixed, default: null },
        },

        privacySettings: {
            _id: false,
            locationSharing: { type: String, enum: ['off', 'friends', 'public'], default: 'off' },
            profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
            storyAudience: { type: String, enum: ['everyone', 'followers', 'close_friends'], default: 'everyone' },
            showOnlineStatus: { type: Boolean, default: true },
            showLastSeen: { type: Boolean, default: true },
        },

        travelerRank: {
            _id: false,
            xp: { type: Number, default: 0 },
            level: { type: String, enum: ['Explorer', 'Adventurer', 'Voyager', 'Legend'], default: 'Explorer' },
            badges: { type: [String], default: [] },
            streakDays: { type: Number, default: 0 },
            lastActivityAt: { type: Date, default: null },
        },

        deviceTokens: [{
            _id: false,
            token: { type: String, required: true },
            platform: { type: String, enum: ['ios', 'android'], required: true },
            lastSeen: { type: Date, default: Date.now },
        }],

        blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        isVendor: { type: Boolean, default: false },
        accountStatus: { type: String, enum: ['active', 'suspended', 'deactivated', 'banned'], default: 'active', index: true },
        lastActiveAt: { type: Date, default: Date.now },
    },
    { timestamps: true, versionKey: false }
);

// ── INDEXES ──────────────────────────────────────────────────
UserSchema.index({ username: 1 });
UserSchema.index({ displayName: 'text', bio: 'text' });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ 'preferences.homeCity': '2dsphere' });
UserSchema.index({ accountStatus: 1, createdAt: -1 });
UserSchema.index({ 'travelerRank.xp': -1 });

// ── STATICS ──────────────────────────────────────────────────
UserSchema.statics.findByUsername = function (username: string) {
    return this.findOne({ username: username.toLowerCase() });
};

export const User = mongoose.model<IUser, IUserModel>('User', UserSchema);
