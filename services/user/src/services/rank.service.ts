
import { User } from '../models/user.model';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

// ── XP ACTIONS ───────────────────────────────────────────────
export const XP_ACTIONS = {
    TRIP_COMPLETED: 500,
    BOOKING_MADE: 200,
    FIVE_STATES_VISITED: 1000,
    LED_THREE_TRIPS: 750,
    TEN_REVIEWS: 300,
    SEVEN_DAY_STREAK: 350,
    THOUSAND_KM: 500,
    FRIEND_REFERRED: 400,
} as const;

// ── LEVEL THRESHOLDS ─────────────────────────────────────────
const LEVELS = [
    { name: 'Explorer', minXp: 0 },
    { name: 'Adventurer', minXp: 2000 },
    { name: 'Voyager', minXp: 8000 },
    { name: 'Legend', minXp: 25000 },
] as const;

function calculateLevel(xp: number): 'Explorer' | 'Adventurer' | 'Voyager' | 'Legend' {
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (xp >= LEVELS[i].minXp) return LEVELS[i].name as any;
    }
    return 'Explorer';
}

export const rankService = {

    // ── AWARD XP ──────────────────────────────────────────────
    async awardXp(userId: string, action: keyof typeof XP_ACTIONS): Promise<{
        newXp: number;
        newLevel: string;
        leveledUp: boolean;
        badgeEarned: string | null;
    }> {
        const xpAmount = XP_ACTIONS[action];
        const user = await User.findById(userId).select('travelerRank');
        if (!user) throw new Error('User not found');

        const oldLevel = user.travelerRank.level;
        const newXp = user.travelerRank.xp + xpAmount;
        const newLevel = calculateLevel(newXp);
        const leveledUp = newLevel !== oldLevel;

        // Check if any badge should be unlocked
        const badgeEarned = this.checkBadge(action, user.travelerRank.badges);

        const $set: Record<string, unknown> = {
            'travelerRank.xp': newXp,
            'travelerRank.level': newLevel,
            'travelerRank.lastActivityAt': new Date(),
        };
        const $addToSet: Record<string, unknown> = {};
        if (badgeEarned) $addToSet['travelerRank.badges'] = badgeEarned;

        await User.updateOne({ _id: userId }, { $set, ...(badgeEarned ? { $addToSet } : {}) });
        await cache.del(cache.keys.profile(userId));

        logger.info({ userId, action, xpAmount, newXp, newLevel, leveledUp, badgeEarned }, 'XP awarded');
        return { newXp, newLevel, leveledUp, badgeEarned };
    },

    // ── CHECK BADGE ───────────────────────────────────────────
    checkBadge(action: keyof typeof XP_ACTIONS, existingBadges: string[]): string | null {
        const badgeMap: Partial<Record<keyof typeof XP_ACTIONS, string>> = {
            TRIP_COMPLETED: 'First Journey',
            BOOKING_MADE: 'Local Hero',
            FIVE_STATES_VISITED: 'Wanderer',
            LED_THREE_TRIPS: 'Trip Captain',
            TEN_REVIEWS: 'Trusted Voice',
            SEVEN_DAY_STREAK: 'On The Road',
            THOUSAND_KM: 'Distance Maker',
            FRIEND_REFERRED: 'Trailblazer',
        };
        const badge = badgeMap[action];
        if (badge && !existingBadges.includes(badge)) return badge;
        return null;
    },

    // ── UPDATE STREAK ─────────────────────────────────────────
    async updateStreak(userId: string): Promise<number> {
        const user = await User.findById(userId).select('travelerRank');
        if (!user) return 0;

        const last = user.travelerRank.lastActivityAt;
        const now = new Date();
        const daysDiff = last ? Math.floor((now.getTime() - last.getTime()) / 86400000) : 999;

        let newStreak = user.travelerRank.streakDays;
        if (daysDiff === 1) newStreak++;       // Consecutive day
        else if (daysDiff > 1) newStreak = 1;  // Streak broken

        await User.updateOne({ _id: userId }, {
            'travelerRank.streakDays': newStreak,
            'travelerRank.lastActivityAt': now,
        });

        // Award streak badge at 7 days
        if (newStreak === 7) await this.awardXp(userId, 'SEVEN_DAY_STREAK');

        return newStreak;
    },
};
