
import mongoose from 'mongoose';
import { Trip, TripRole } from '../models/trip.model';
import { publishTripEvent } from '../utils/kafkaPublisher';
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const collaboratorService = {

    // ── INVITE USER ───────────────────────────────────────────
    async invite(tripId: string, adminId: string, targetUserId: string, role: TripRole = 'member'): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('TRIP_NOT_FOUND');
        if (trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');
        if (trip.collaborators.length >= trip.maxCollaborators) throw new Error('MAX_COLLABORATORS_REACHED');

        // Idempotent: skip if already a collaborator
        const existing = trip.collaborators.find(c => c.userId.toString() === targetUserId);
        if (existing && existing.status === 'active') return;

        if (existing) {
            // Re-invite if they left
            await Trip.updateOne(
                { _id: tripId, 'collaborators.userId': new mongoose.Types.ObjectId(targetUserId) },
                { $set: { 'collaborators.$.status': 'invited', 'collaborators.$.role': role } }
            );
        } else {
            await Trip.updateOne(
                { _id: tripId },
                {
                    $push: {
                        collaborators: {
                            userId: new mongoose.Types.ObjectId(targetUserId),
                            role, status: 'invited', contributionScore: 0,
                        }
                    }
                }
            );
        }

        publishTripEvent('trip.collaborator_invited', {
            tripId, adminId, targetUserId, role,
            inviteLink: `${config.appBaseUrl}/trips/${trip.slug}/join`,
        });
        logger.info({ tripId, targetUserId, role }, 'Collaborator invited');
    },

    // ── ACCEPT INVITE ─────────────────────────────────────────
    async acceptInvite(tripId: string, userId: string): Promise<void> {
        const result = await Trip.updateOne(
            { _id: tripId, 'collaborators.userId': new mongoose.Types.ObjectId(userId), 'collaborators.status': 'invited' },
            { $set: { 'collaborators.$.status': 'active', 'collaborators.$.joinedAt': new Date() } }
        );
        if (result.modifiedCount === 0) throw new Error('INVITE_NOT_FOUND');

        publishTripEvent('trip.collaborator_joined', { tripId, userId });
    },

    // ── REQUEST TO JOIN (public trips) ────────────────────────
    async requestJoin(tripId: string, userId: string, message?: string): Promise<void> {
        const trip = await Trip.findById(tripId).select('visibility adminId joinRequests');
        if (!trip) throw new Error('TRIP_NOT_FOUND');
        if (trip.visibility !== 'public') throw new Error('TRIP_NOT_PUBLIC');

        // Idempotent
        const existing = trip.joinRequests.find(r => r.userId.toString() === userId && r.status === 'pending');
        if (existing) return;

        await Trip.updateOne({ _id: tripId }, {
            $push: { joinRequests: { userId: new mongoose.Types.ObjectId(userId), message, status: 'pending', requestedAt: new Date() } },
        });

        publishTripEvent('trip.join_requested', { tripId, userId, adminId: trip.adminId.toString(), message });
    },

    // ── APPROVE / REJECT JOIN REQUEST ─────────────────────────
    async handleJoinRequest(
        tripId: string,
        adminId: string,
        userId: string,
        action: 'approve' | 'reject',
        role: TripRole = 'member'
    ): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('TRIP_NOT_FOUND');
        if (trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        // Update join request status
        await Trip.updateOne(
            { _id: tripId, 'joinRequests.userId': new mongoose.Types.ObjectId(userId) },
            { $set: { 'joinRequests.$.status': action === 'approve' ? 'approved' : 'rejected' } }
        );

        if (action === 'approve') {
            await Trip.updateOne({ _id: tripId }, {
                $push: {
                    collaborators: {
                        userId: new mongoose.Types.ObjectId(userId),
                        role, status: 'active', joinedAt: new Date(), contributionScore: 0,
                    }
                },
            });
            publishTripEvent('trip.collaborator_joined', { tripId, userId, role });
        }
    },

    // ── REMOVE COLLABORATOR ───────────────────────────────────
    async remove(tripId: string, adminId: string, targetUserId: string): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');
        if (targetUserId === adminId) throw new Error('CANNOT_REMOVE_ADMIN');

        await Trip.updateOne(
            { _id: tripId, 'collaborators.userId': new mongoose.Types.ObjectId(targetUserId) },
            { $set: { 'collaborators.$.status': 'removed' } }
        );
        publishTripEvent('trip.collaborator_removed', { tripId, adminId, targetUserId });
    },

    // ── UPDATE ROLE ───────────────────────────────────────────
    async updateRole(tripId: string, adminId: string, targetUserId: string, role: TripRole): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');
        if (role === 'admin') throw new Error('CANNOT_ASSIGN_ADMIN_ROLE');

        await Trip.updateOne(
            { _id: tripId, 'collaborators.userId': new mongoose.Types.ObjectId(targetUserId) },
            { $set: { 'collaborators.$.role': role } }
        );
    },

    // ── CHECK ROLE ────────────────────────────────────────────
    async getRole(tripId: string, userId: string): Promise<TripRole | null> {
        const trip = await Trip.findById(tripId).select('adminId collaborators').lean();
        if (!trip) return null;
        if (trip.adminId.toString() === userId) return 'admin';
        const collab = trip.collaborators.find(
            (c: any) => c.userId.toString() === userId && c.status === 'active'
        );
        return collab ? collab.role as TripRole : null;
    },
};
