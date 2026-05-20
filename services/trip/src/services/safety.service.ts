
import { Trip } from '../models/trip.model';
import { redis } from '../config/redis';
import { config } from '../config';
import { publishTripEvent } from '../utils/kafkaPublisher';
import { v4 as uuid } from 'uuid';

export const safetyService = {

    // ── TRIGGER SOS ───────────────────────────────────────────
    async triggerSos(tripId: string, userId: string, location?: { lat: number; lng: number }): Promise<void> {
        const trip = await Trip.findById(tripId).select('safety collaborators adminId');
        if (!trip) throw new Error('TRIP_NOT_FOUND');

        // Publish SOS event → Notification Service sends SMS + push to all contacts
        publishTripEvent('trip.sos_triggered', {
            tripId, userId,
            location,
            sosContacts: trip.safety.sosContacts,
            collaboratorIds: trip.collaborators.filter((c: any) => c.status === 'active').map((c: any) => c.userId.toString()),
            triggeredAt: new Date().toISOString(),
        });
    },

    // ── SAFE CHECK-IN ─────────────────────────────────────────
    async safeCheckin(tripId: string, userId: string): Promise<void> {
        const key = `safety:checkin:${tripId}:${userId}`;
        await redis.setex(key, 7 * 3600, 'safe'); // Valid for 7 hours

        publishTripEvent('trip.safe_checkin', { tripId, userId, checkedInAt: new Date().toISOString() });
    },

    // ── GENERATE TRUSTED CONTACT LINK ─────────────────────────
    async generateTrustedContactLink(tripId: string, adminId: string): Promise<string> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        const token = uuid();
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        await Trip.updateOne({ _id: tripId }, {
            $set: {
                'safety.trustedContactToken': token,
                'safety.trustedContactExpiry': expiry,
            },
        });

        return `${config.appBaseUrl}/track/${token}`;
    },

    // ── TOGGLE EMERGENCY MODE ─────────────────────────────────
    async setEmergencyMode(tripId: string, adminId: string, active: boolean): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        await Trip.updateOne({ _id: tripId }, { $set: { 'safety.emergencyMode': active } });

        if (active) {
            publishTripEvent('trip.emergency_mode_activated', {
                tripId,
                collaboratorIds: trip.collaborators.filter((c: any) => c.status === 'active').map((c: any) => c.userId.toString()),
                sosContacts: trip.safety.sosContacts,
                activatedAt: new Date().toISOString(),
            });
        }
    },

    // ── UPDATE SOS CONTACTS ───────────────────────────────────
    async updateSosContacts(tripId: string, adminId: string, contacts: Array<{ name: string; phone: string }>): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');
        await Trip.updateOne({ _id: tripId }, { $set: { 'safety.sosContacts': contacts } });
    },
};
