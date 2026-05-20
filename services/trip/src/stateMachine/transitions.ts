
import { TripStatus } from '../models/trip.model';

// ── VALID TRANSITION MAP ──────────────────────────────────────
export const ALLOWED_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
    draft: ['planning', 'cancelled'],
    planning: ['active', 'cancelled'],
    active: ['completed', 'cancelled'],
    completed: ['archived'],
    archived: [],
    cancelled: [],
};

// ── SIDE-EFFECT REGISTRY ──────────────────────────────────────
// Each transition can have automated actions.
// These are published as Kafka events consumed by other services.
export interface TransitionEffect {
    kafkaEvents: string[];  // Topic names to publish
    requiresAdmin: boolean;   // Only admin can trigger?
    requiresDate: boolean;   // Requires start date to have passed?
}

export const TRANSITION_EFFECTS: Record<string, TransitionEffect> = {
    'draft->planning': {
        kafkaEvents: ['trip.state_changed'],
        requiresAdmin: true,
        requiresDate: false,
    },
    'planning->active': {
        kafkaEvents: ['trip.state_changed'],
        requiresAdmin: true,
        requiresDate: true,  // Start date must be today or past
    },
    'active->completed': {
        kafkaEvents: ['trip.state_changed', 'trip.completed'],
        requiresAdmin: true,
        requiresDate: false,
    },
    'completed->archived': {
        kafkaEvents: ['trip.state_changed'],
        requiresAdmin: true,
        requiresDate: false,
    },
    'draft->cancelled': {
        kafkaEvents: ['trip.state_changed', 'trip.cancelled'],
        requiresAdmin: true,
        requiresDate: false,
    },
    'planning->cancelled': {
        kafkaEvents: ['trip.state_changed', 'trip.cancelled'],
        requiresAdmin: true,
        requiresDate: false,
    },
    'active->cancelled': {
        kafkaEvents: ['trip.state_changed', 'trip.cancelled'],
        requiresAdmin: true,
        requiresDate: false,
    },
};
