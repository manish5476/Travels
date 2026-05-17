import {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from './logger';

export const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});

export type AvatarSize = 'thumb' | 'full';

// ── KEY GENERATOR ─────────────────────────────────────────
// avatars/{userId}/thumb.jpg  (150x150)
// avatars/{userId}/full.jpg   (400x400)
export function avatarKey(userId: string, size: AvatarSize): string {
    return `avatars/${userId}/${size}.jpg`;
}

// ── CDN URL ───────────────────────────────────────────────
export function avatarCdnUrl(userId: string, size: AvatarSize): string {
    return `${config.aws.cdnBaseUrl}/${avatarKey(userId, size)}`;
}

// ── GET PRESIGNED UPLOAD URL ──────────────────────────────
// Client uploads directly to S3 — backend never handles the bytes.
// Expires in 5 minutes.
export async function getPresignedUploadUrl(
    userId: string,
    size: AvatarSize,
    contentType: string = 'image/jpeg'
): Promise<string> {
    const key = avatarKey(userId, size);
    const command = new PutObjectCommand({
        Bucket: config.aws.s3AvatarBucket,
        Key: key,
        ContentType: contentType,
        Metadata: { userId, size, uploadedAt: new Date().toISOString() },
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    logger.info({ userId, size, key }, 'Avatar presigned URL generated');
    return url;
}

// ── DELETE OLD AVATAR ────────────────────────────────────
export async function deleteAvatar(userId: string): Promise<void> {
    const sizes: AvatarSize[] = ['thumb', 'full'];
    await Promise.allSettled(
        sizes.map(size =>
            s3Client.send(new DeleteObjectCommand({
                Bucket: config.aws.s3AvatarBucket,
                Key: avatarKey(userId, size),
            }))
        )
    );
    logger.info({ userId }, 'Old avatars deleted from S3');
}
