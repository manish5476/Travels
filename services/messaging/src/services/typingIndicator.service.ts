
import { redis } from '../config/redis';
import { config } from '../config';

// Redis key: typing:{conversationId}:{userId}
// TTL: TYPING_TTL_SECONDS (3s) — auto-expires if client disconnects
// This means 'typing stopped' is handled automatically by TTL expiry.

export const typingService = {

    // ── START TYPING ──────────────────────────────────────────
    // Client sends this on first keystroke (debounced — not on every key).
    // Returns true if this is a NEW typing event (not a refresh of existing).
    async startTyping(conversationId: string, userId: string): Promise<boolean> {
        const key = `typing:${conversationId}:${userId}`;
        // NX = only set if not exists. Returns 1 if newly set, null if already existed.
        const isNew = await redis.set(key, '1', 'EX', config.limits.typingTtl, 'NX');
        if (!isNew) {
            // Already typing — just refresh TTL (don't broadcast again)
            await redis.expire(key, config.limits.typingTtl);
            return false; // Not new — don't re-broadcast
        }
        return true; // New typing event — broadcast to room
    },

    // ── STOP TYPING ───────────────────────────────────────────
    // Client sends this on blur or 2s of inactivity.
    async stopTyping(conversationId: string, userId: string): Promise<void> {
        await redis.del(`typing:${conversationId}:${userId}`);
    },

    // ── GET WHO IS TYPING ─────────────────────────────────────
    // Returns list of user IDs currently typing in a conversation.
    async getTypingUsers(conversationId: string, memberIds: string[]): Promise<string[]> {
        const pipeline = redis.pipeline();
        memberIds.forEach(id => pipeline.exists(`typing:${conversationId}:${id}`));
        const results = await pipeline.exec();
        return memberIds.filter((id, i) => results?.[i]?.[1] === 1);
    },
};
