
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { publishMessagingEvent } from '../utils/kafkaPublisher';

// Redis key: user:online:{userId}
// Value: '1'
// TTL:   PRESENCE_TTL_SECONDS (30s)
// Client sends heartbeat every HEARTBEAT_INTERVAL_MS (15s) to refresh.

export const presenceService = {

    // ── SET ONLINE ────────────────────────────────────────────
    async setOnline(userId: string): Promise<void> {
        await redis.setex(`user:online:${userId}`, config.limits.presenceTtl, '1');
    },

    // ── REFRESH (heartbeat) ───────────────────────────────────
    // Called every 15s from socket heartbeat to keep key alive.
    async refresh(userId: string): Promise<void> {
        await redis.expire(`user:online:${userId}`, config.limits.presenceTtl);
    },

    // ── SET OFFLINE ───────────────────────────────────────────
    async setOffline(userId: string): Promise<void> {
        await redis.del(`user:online:${userId}`);
        // Publish so User Service updates lastActiveAt in DB
        publishMessagingEvent('user.offline', { userId, lastSeenAt: new Date().toISOString() });
    },

    // ── IS ONLINE ─────────────────────────────────────────────
    async isOnline(userId: string): Promise<boolean> {
        return (await redis.exists(`user:online:${userId}`)) === 1;
    },

    // ── GET ONLINE STATUS FOR MULTIPLE USERS ──────────────────
    // Used when opening a conversation to show who is online.
    async getOnlineStatus(userIds: string[]): Promise<Record<string, boolean>> {
        if (userIds.length === 0) return {};
        const pipeline = redis.pipeline();
        userIds.forEach(id => pipeline.exists(`user:online:${id}`));
        const results = await pipeline.exec();
        return Object.fromEntries(
            userIds.map((id, i) => [id, results?.[i]?.[1] === 1])
        );
    },

    // ── GET ONLINE MEMBERS IN CONVERSATION ────────────────────
    async getOnlineMembers(memberIds: string[]): Promise<string[]> {
        const status = await this.getOnlineStatus(memberIds);
        return memberIds.filter(id => status[id]);
    },
};
