
import { Trip, TripStatus } from '../models/trip.model';
import { ALLOWED_TRANSITIONS, TRANSITION_EFFECTS } from './transitions';
import { publishTripEvent } from '../utils/kafkaPublisher';
import { logger } from '../utils/logger';

export class StateMachineError extends Error {
    constructor(message: string, public code: string, public status: number) {
        super(message); this.name = 'StateMachineError';
    }
}

export const tripStateMachine = {

    // ── TRANSITION ────────────────────────────────────────────
    async transition(
        tripId: string,
        userId: string,
        toState: TripStatus
    ): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new StateMachineError('Trip not found', 'TRIP_NOT_FOUND', 404);

        const fromState = trip.status;
        const transKey = `${fromState}->${toState}`;
        const effects = TRANSITION_EFFECTS[transKey];

        // ── VALIDATE TRANSITION ──────────────────────────────
        const allowed = ALLOWED_TRANSITIONS[fromState];
        if (!allowed.includes(toState)) {
            throw new StateMachineError(
                `Cannot transition from '${fromState}' to '${toState}'`,
                'INVALID_TRANSITION', 400
            );
        }

        // ── VALIDATE PERMISSIONS ─────────────────────────────
        if (effects?.requiresAdmin) {
            const isAdmin = trip.adminId.toString() === userId ||
                trip.collaborators.some(c =>
                    c.userId.toString() === userId &&
                    c.role === 'co-admin' &&
                    c.status === 'active'
                );
            if (!isAdmin) {
                throw new StateMachineError('Only admin can perform this transition', 'FORBIDDEN', 403);
            }
        }

        // ── VALIDATE DATE REQUIREMENT ────────────────────────
        if (effects?.requiresDate && trip.dates?.start) {
            const now = new Date();
            const start = new Date(trip.dates.start);
            // Allow activating 1 hour before start
            const threshold = new Date(start.getTime() - 60 * 60 * 1000);
            if (now < threshold) {
                throw new StateMachineError(
                    `Trip cannot be activated before ${start.toLocaleDateString()}`,
                    'DATE_NOT_REACHED', 400
                );
            }
        }

        // ── APPLY TRANSITION ─────────────────────────────────
        const updates: Record<string, unknown> = { status: toState };
        if (toState === 'completed') updates['completedAt'] = new Date();
        if (toState === 'active') updates['memoryReelStatus'] = 'not_started';

        await Trip.updateOne({ _id: tripId }, { $set: updates });

        // ── PUBLISH KAFKA EVENTS ──────────────────────────────
        const collaboratorIds = trip.collaborators
            .filter(c => c.status === 'active')
            .map(c => c.userId.toString());

        const eventPayload = {
            tripId: tripId,
            adminId: trip.adminId.toString(),
            fromState,
            toState,
            collaboratorIds,
            destination: trip.destination?.label,
            changedAt: new Date().toISOString(),
        };

        for (const topic of (effects?.kafkaEvents || ['trip.state_changed'])) {
            publishTripEvent(topic, eventPayload);
        }

        logger.info({ tripId, fromState, toState, userId }, 'Trip state transitioned');
    },

    // ── CAN TRANSITION ────────────────────────────────────────
    canTransition(fromState: TripStatus, toState: TripStatus): boolean {
        return ALLOWED_TRANSITIONS[fromState]?.includes(toState) ?? false;
    },

    // ── GET ALLOWED TRANSITIONS ───────────────────────────────
    getAllowed(fromState: TripStatus): TripStatus[] {
        return ALLOWED_TRANSITIONS[fromState] || [];
    },
};
