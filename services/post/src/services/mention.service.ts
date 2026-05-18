
import { Post } from '../models/post.model';
import { publishPostEvent } from '../utils/kafkaPublisher';
import { logger } from '../utils/logger';

// Internal HTTP client — calls User Service to resolve usernames to IDs
async function resolveUsernames(usernames: string[]): Promise<Record<string, string>> {
    if (usernames.length === 0) return {};
    try {
        const res = await fetch(`${process.env.USER_SERVICE_URL}/internal/resolve-usernames`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames }),
        });
        if (!res.ok) return {};
        const data = await res.json() as { data: Record<string, string> };
        return data.data || {};
    } catch (err) {
        logger.warn({ err }, 'Failed to resolve @mentions — skipping');
        return {};
    }
}

export const mentionService = {

    // ── EXTRACT USERNAMES ─────────────────────────────────────
    extractUsernames(text: string): string[] {
        const matches = text.match(/@([a-zA-Z0-9_.]{3,30})/g) || [];
        return [...new Set(matches.map(m => m.slice(1).toLowerCase()))].slice(0, 10);
    },

    // ── PROCESS MENTIONS ──────────────────────────────────────
    // Resolves usernames to IDs, updates post document, publishes notifications
    async processMentions(postId: string, usernames: string[], authorId: string): Promise<void> {
        if (usernames.length === 0) return;

        const usernameToId = await resolveUsernames(usernames);
        const mentionedIds = Object.values(usernameToId).filter(id => id !== authorId);

        if (mentionedIds.length === 0) return;

        // Update post with resolved user IDs
        await Post.updateOne(
            { _id: postId },
            { $addToSet: { mentions: { $each: mentionedIds } } }
        );

        // Publish mention event → Notification Service sends @mention push
        publishPostEvent('post.mentioned', {
            postId,
            authorId,
            mentionedUserIds: mentionedIds,
            mentionedAt: new Date().toISOString(),
        });
    },
};
