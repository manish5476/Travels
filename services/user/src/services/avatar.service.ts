
import { User } from '../models/user.model';
import { getPresignedUploadUrl, avatarCdnUrl, deleteAvatar } from '../utils/s3';
import { cache } from '../utils/cache';
import { logger } from '../utils/logger';

export const avatarService = {

    // ── GET PRESIGNED UPLOAD URLS ─────────────────────────────
    // Client calls this → gets 2 URLs → uploads both directly to S3
    // Client then calls confirmUpload() to update DB with CDN URLs
    async getUploadUrls(userId: string): Promise<{ thumbUrl: string; fullUrl: string }> {
        const [thumbUrl, fullUrl] = await Promise.all([
            getPresignedUploadUrl(userId, 'thumb'),
            getPresignedUploadUrl(userId, 'full'),
        ]);
        logger.info({ userId }, 'Avatar upload URLs generated');
        return { thumbUrl, fullUrl };
    },

    // ── CONFIRM UPLOAD ────────────────────────────────────────
    // Called AFTER client successfully uploads to S3
    // Updates user document with CDN URLs (cache-busted via ?v=timestamp)
    async confirmUpload(userId: string): Promise<{ avatarUrl: string; avatarFullUrl: string }> {
        const v = Date.now();  // Cache-buster version
        const avatarUrl = `${avatarCdnUrl(userId, 'thumb')}?v=${v}`;
        const avatarFullUrl = `${avatarCdnUrl(userId, 'full')}?v=${v}`;

        await User.updateOne(
            { _id: userId },
            { avatarUrl, avatarFullUrl }
        );

        // Invalidate profile cache so next read returns new avatar
        await cache.del(cache.keys.profile(userId));

        logger.info({ userId, avatarUrl }, 'Avatar confirmed and DB updated');
        return { avatarUrl, avatarFullUrl };
    },

    // ── REMOVE AVATAR ─────────────────────────────────────────
    async removeAvatar(userId: string): Promise<void> {
        await Promise.all([
            deleteAvatar(userId),
            User.updateOne({ _id: userId }, { $unset: { avatarUrl: 1, avatarFullUrl: 1 } }),
        ]);
        await cache.del(cache.keys.profile(userId));
        logger.info({ userId }, 'Avatar removed');
    },
};
