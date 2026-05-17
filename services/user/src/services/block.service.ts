
import { User } from '../models/user.model';
import { Follow } from '../models/follow.model';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

const MAX_BLOCKED = 500;

export const blockService = {

    // ── BLOCK ─────────────────────────────────────────────────
    async block(blockerId: string, blockedId: string): Promise<void> {
        if (blockerId === blockedId) throw new Error('Cannot block yourself');

        const blocker = await User.findById(blockerId).select('blockedUsers');
        if (!blocker) throw new Error('User not found');

        if (blocker.blockedUsers.length >= MAX_BLOCKED) {
            throw new Error(`Block limit reached (max ${MAX_BLOCKED})`);
        }

        // Add to block list (addToSet = idempotent)
        await User.updateOne(
            { _id: blockerId },
            { $addToSet: { blockedUsers: blockedId } }
        );

        // Silently remove any follow relationship in both directions
        const [fwd, rev] = await Promise.all([
            Follow.deleteOne({ followerId: blockerId, followingId: blockedId }),
            Follow.deleteOne({ followerId: blockedId, followingId: blockerId }),
        ]);

        // Update counters if follows existed
        const updates = [];
        if (fwd.deletedCount > 0) {
            updates.push(User.updateOne({ _id: blockerId }, { $inc: { followingCount: -1 } }));
            updates.push(User.updateOne({ _id: blockedId }, { $inc: { followerCount: -1 } }));
        }
        if (rev.deletedCount > 0) {
            updates.push(User.updateOne({ _id: blockedId }, { $inc: { followingCount: -1 } }));
            updates.push(User.updateOne({ _id: blockerId }, { $inc: { followerCount: -1 } }));
        }
        if (updates.length > 0) await Promise.all(updates);

        // Invalidate caches
        await Promise.all([
            cache.del(cache.keys.isBlocked(blockerId, blockedId)),
            cache.del(cache.keys.isFollowing(blockerId, blockedId)),
            cache.del(cache.keys.isFollowing(blockedId, blockerId)),
            cache.del(cache.keys.profile(blockerId)),
            cache.del(cache.keys.profile(blockedId)),
        ]);

        logger.info({ blockerId, blockedId }, 'User blocked');
    },

    // ── UNBLOCK ───────────────────────────────────────────────
    async unblock(blockerId: string, blockedId: string): Promise<void> {
        await User.updateOne(
            { _id: blockerId },
            { $pull: { blockedUsers: blockedId } }
        );
        await cache.del(cache.keys.isBlocked(blockerId, blockedId));
        logger.info({ blockerId, blockedId }, 'User unblocked');
    },

    // ── IS BLOCKED ────────────────────────────────────────────
    async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
        const cacheKey = cache.keys.isBlocked(blockerId, blockedId);
        return cache.getOrFetch(
            cacheKey,
            async () => {
                const user = await User.exists({
                    _id: blockerId,
                    blockedUsers: blockedId,
                });
                return !!user;
            },
            300  // 5 minutes
        );
    },

    // ── IS BLOCKED IN EITHER DIRECTION ───────────────────────
    async isBlockedEither(userAId: string, userBId: string): Promise<boolean> {
        const [aBlocksB, bBlocksA] = await Promise.all([
            this.isBlocked(userAId, userBId),
            this.isBlocked(userBId, userAId),
        ]);
        return aBlocksB || bBlocksA;
    },

    // ── GET BLOCKED LIST ──────────────────────────────────────
    async getBlockedList(userId: string, _cursor?: string, limit = 20) {
        const user = await User.findById(userId)
            .select('blockedUsers')
            .populate({ path: 'blockedUsers', select: 'username displayName avatarUrl', options: { limit } })
            .lean();

        return { blocked: user?.blockedUsers || [] };
    },
};
