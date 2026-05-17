import mongoose from 'mongoose';
import { User, IUser } from '../models/user.model';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';
import { config } from '../config';

export class UserError extends Error {
    constructor(message: string, public code: string, public status: number) {
        super(message); this.name = 'UserError';
    }
}
const Err = {
    notFound: () => new UserError('User not found', 'USER_NOT_FOUND', 404),
    forbidden: () => new UserError('Forbidden', 'FORBIDDEN', 403),
    conflict: (m: string) => new UserError(m, 'CONFLICT', 409),
    badRequest: (m: string) => new UserError(m, 'BAD_REQUEST', 400),
};

export const userService = {

    // ── CREATE PROFILE ────────────────────────────────────────
    // Called by Kafka consumer when user.registered event arrives from Auth Service
    async createFromAuthEvent(data: {
        userId: string; phone?: string; email?: string;
        displayName?: string; avatarUrl?: string;
    }): Promise<IUser> {
        // Generate unique username from displayName or phone
        const base = (data.displayName || data.phone || data.email || 'user')
            .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        let username = base || 'user';

        // Ensure uniqueness — append random suffix if taken
        const existing = await User.findByUsername(username);
        if (existing) username = `${username}${Math.floor(1000 + Math.random() * 9000)}`;

        const user = await User.create({
            _id: new mongoose.Types.ObjectId(data.userId),
            username,
            displayName: data.displayName || username,
            bio: '',
            phone: data.phone,
            email: data.email,
            avatarUrl: data.avatarUrl,
        });

        logger.info({ userId: user._id, username }, 'User profile created');
        return user;
    },

    // ── GET BY ID ─────────────────────────────────────────────
    async getById(userId: string): Promise<IUser> {
        const cacheKey = cache.keys.profile(userId);
        return cache.getOrFetch(
            cacheKey,
            async () => {
                const user = await User.findById(userId)
                    .select('-blockedUsers -deviceTokens');
                if (!user) throw Err.notFound();
                return user.toObject();
            },
            config.cache.profileTtl
        );
    },

    // ── GET BY USERNAME ───────────────────────────────────────
    async getByUsername(username: string, requesterId?: string): Promise<Partial<IUser>> {
        const cacheKey = cache.keys.profileByName(username);
        const user = await cache.getOrFetch<IUser>(
            cacheKey,
            async () => {
                const u = await User.findOne({ username: username.toLowerCase() })
                    .select('-blockedUsers -deviceTokens');
                if (!u) throw Err.notFound();
                return u.toObject() as IUser;
            },
            config.cache.profileTtl
        );

        // Respect privacy: private profiles only visible to followers
        if (user.privacySettings.profileVisibility === 'private' && requesterId !== user._id.toString()) {
            return {
                _id: user._id, username: user.username,
                displayName: user.displayName, avatarUrl: user.avatarUrl,
                bio: 'This account is private',
                followerCount: user.followerCount, followingCount: user.followingCount,
            };
        }

        return user;
    },

    // ── UPDATE PROFILE ────────────────────────────────────────
    async updateProfile(userId: string, updates: {
        displayName?: string;
        bio?: string;
        website?: string;
        preferences?: Partial<IUser['preferences']>;
        privacySettings?: Partial<IUser['privacySettings']>;
    }): Promise<IUser> {
        // Build flat update object
        const $set: Record<string, unknown> = {};
        if (updates.displayName) $set['displayName'] = updates.displayName;
        if (updates.bio !== undefined) $set['bio'] = updates.bio;
        if (updates.website) $set['website'] = updates.website;
        if (updates.preferences) {
            Object.entries(updates.preferences).forEach(([k, v]) => {
                $set[`preferences.${k}`] = v;
            });
        }
        if (updates.privacySettings) {
            Object.entries(updates.privacySettings).forEach(([k, v]) => {
                $set[`privacySettings.${k}`] = v;
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set },
            { new: true, runValidators: true }
        ).select('-blockedUsers -deviceTokens');

        if (!user) throw Err.notFound();

        // Invalidate profile cache
        await cache.del(cache.keys.profile(userId));
        await cache.del(cache.keys.profileByName(user.username));

        logger.info({ userId }, 'Profile updated');
        return user;
    },

    // ── SEARCH USERS ─────────────────────────────────────────
    // Simple text search — Elasticsearch is used for full search in Search Service
    // This is just for quick @mention autocomplete
    async search(query: string, limit = 10): Promise<Partial<IUser>[]> {
        if (!query || query.length < 2) return [];
        const users = await User.find({
            accountStatus: 'active',
            $or: [
                { username: { $regex: `^${query}`, $options: 'i' } },
                { displayName: { $regex: query, $options: 'i' } },
            ],
        })
            .select('username displayName avatarUrl followerCount')
            .limit(limit)
            .lean();
        return users as unknown as Partial<IUser>[];
    },

    // ── UPDATE DEVICE TOKEN ───────────────────────────────────
    async upsertDeviceToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
        // Remove old entry for same token, add new one
        await User.updateOne(
            { _id: userId },
            {
                $pull: { deviceTokens: { token } },         // Remove if exists
            }
        );
        await User.updateOne(
            { _id: userId },
            {
                $push: {
                    deviceTokens: {
                        $each: [{ token, platform, lastSeen: new Date() }],
                        $slice: -5,  // Keep only 5 most recent device tokens
                    },
                },
            }
        );
        // Invalidate device token cache
        await cache.del(cache.keys.deviceTokens(userId));
    },

    // ── GET DEVICE TOKENS (internal — for Notification Service) ──
    async getDeviceTokens(userId: string): Promise<string[]> {
        const cacheKey = cache.keys.deviceTokens(userId);
        return cache.getOrFetch(
            cacheKey,
            async () => {
                const user = await User.findById(userId).select('deviceTokens').lean();
                return (user?.deviceTokens || []).map((d: any) => d.token);
            },
            300 // 5 minutes
        );
    },

    // ── INCREMENT COUNTER ─────────────────────────────────────
    // Used by other services via Kafka events
    async incrementCounter(userId: string, field: 'postCount' | 'tripCount', by = 1): Promise<void> {
        await User.updateOne({ _id: userId }, { $inc: { [field]: by } });
        await cache.del(cache.keys.profile(userId));
    },

    // ── UPDATE TRAVEL STATS ───────────────────────────────────
    async addTravelStat(userId: string, country: string, city: string, km: number): Promise<void> {
        await User.updateOne({ _id: userId }, {
            $addToSet: {
                'travelStats.countriesVisited': country,
                'travelStats.citiesVisited': city,
            },
            $inc: { 'travelStats.totalKm': km, 'travelStats.tripsCompleted': 0 },
        });
        await cache.del(cache.keys.profile(userId));
    },

    // ── UPDATE LAST ACTIVE ────────────────────────────────────
    async updateLastActive(userId: string): Promise<void> {
        await User.updateOne({ _id: userId }, { lastActiveAt: new Date() });
        // Also set Redis online key (TTL = 30s for real-time presence)
        await cache.set(cache.keys.onlineStatus(userId), '1', 30);
    },
};
