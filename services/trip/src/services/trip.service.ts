
import mongoose from 'mongoose';
import { Trip, ITrip } from '../models/trip.model';
import { tripStateMachine } from '../stateMachine/trip.stateMachine';
import { slugGenerator } from '../utils/slugGenerator';
import { publishTripEvent } from '../utils/kafkaPublisher';
import { redis } from '../config/redis';
import { logger } from '../utils/logger';

export class TripError extends Error {
    constructor(message: string, public code: string, public status: number) {
        super(message); this.name = 'TripError';
    }
}
const Err = {
    notFound: () => new TripError('Trip not found', 'TRIP_NOT_FOUND', 404),
    forbidden: () => new TripError('Access denied', 'FORBIDDEN', 403),
    badRequest: (m: string) => new TripError(m, 'BAD_REQUEST', 400),
    conflict: (m: string) => new TripError(m, 'CONFLICT', 409),
};

export const tripService = {

    // ── CREATE ────────────────────────────────────────────────
    async create(adminId: string, data: CreateTripDTO): Promise<ITrip> {
        const slug = await slugGenerator.generate(data.destination?.label || 'trip');
        const durationDays = data.dates
            ? Math.ceil((new Date(data.dates.end).getTime() - new Date(data.dates.start).getTime()) / 86400000)
            : 0;

        const trip = await Trip.create({
            slug,
            title: data.title,
            description: data.description,
            adminId: new mongoose.Types.ObjectId(adminId),
            collaborators: [{
                userId: new mongoose.Types.ObjectId(adminId),
                role: 'admin',
                status: 'active',
                joinedAt: new Date(),
                contributionScore: 0,
            }],
            origin: data.origin,
            destination: data.destination,
            dates: data.dates,
            durationDays,
            budget: data.budget || { estimated: 0, actual: 0, currency: 'INR', perPerson: 0 },
            visibility: data.visibility || 'private',
            tags: data.tags || [],
            maxCollaborators: data.maxCollaborators || 20,
            safety: { sosContacts: [], emergencyMode: false },
            aiItinerary: [],
            packingList: [],
        });

        logger.info({ tripId: trip._id, adminId, slug }, 'Trip created');
        return trip;
    },

    // ── GET BY ID ─────────────────────────────────────────────
    async getById(tripId: string, userId?: string): Promise<ITrip> {
        const trip = await Trip.findById(tripId).lean();
        if (!trip) throw Err.notFound();

        // Private trips: only collaborators can view
        if (trip.visibility === 'private' && userId) {
            const isMember = trip.collaborators.some(
                c => c.userId.toString() === userId && c.status === 'active'
            );
            if (!isMember) throw Err.forbidden();
        }

        return trip as unknown as ITrip;
    },

    // ── GET BY SLUG ───────────────────────────────────────────
    async getBySlug(slug: string): Promise<ITrip> {
        const trip = await Trip.findOne({ slug }).lean();
        if (!trip) throw Err.notFound();
        return trip as unknown as ITrip;
    },

    // ── GET MY TRIPS ──────────────────────────────────────────
    async getMyTrips(userId: string, status?: string) {
        const query: Record<string, unknown> = {
            'collaborators.userId': new mongoose.Types.ObjectId(userId),
            'collaborators.status': 'active',
        };
        if (status) query['status'] = status;

        return Trip.find(query)
            .sort({ 'dates.start': -1 })
            .select('slug title status visibility dates destination coverMediaUrl collaborators tags')
            .lean();
    },

    // ── GET PUBLIC TRIPS ──────────────────────────────────────
    async getPublic(cursor?: string, limit = 20, destination?: string) {
        const query: Record<string, unknown> = {
            visibility: 'public',
            status: { $in: ['planning', 'active', 'completed'] },
        };
        if (destination) {
            query['$text'] = { $search: destination };
        }
        if (cursor) query['_id'] = { $lt: new mongoose.Types.ObjectId(cursor) };

        const trips = await Trip.find(query)
            .sort({ _id: -1 })
            .limit(limit + 1)
            .select('slug title status dates destination coverMediaUrl collaborators tags')
            .lean();

        const hasMore = trips.length > limit;
        const items = hasMore ? trips.slice(0, limit) : trips;
        const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;
        return { trips: items, nextCursor };
    },

    // ── UPDATE ────────────────────────────────────────────────
    async update(tripId: string, userId: string, data: UpdateTripDTO): Promise<ITrip> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw Err.notFound();

        // Only admin or co-admin can update
        const isAdmin = trip.adminId.toString() === userId ||
            trip.collaborators.some(c => c.userId.toString() === userId && c.role === 'co-admin' && c.status === 'active');
        if (!isAdmin) throw Err.forbidden();

        if (['completed', 'archived', 'cancelled'].includes(trip.status)) {
            throw Err.badRequest('Cannot update a trip in this state');
        }

        const $set: Record<string, unknown> = {};
        if (data.title) $set['title'] = data.title;
        if (data.description !== undefined) $set['description'] = data.description;
        if (data.dates) $set['dates'] = data.dates;
        if (data.budget) $set['budget'] = data.budget;
        if (data.visibility) $set['visibility'] = data.visibility;
        if (data.tags) $set['tags'] = data.tags;
        if (data.coverMediaUrl !== undefined) $set['coverMediaUrl'] = data.coverMediaUrl;

        const updated = await Trip.findByIdAndUpdate(tripId, { $set }, { new: true });
        if (!updated) throw Err.notFound();
        return updated;
    },

    // ── TRANSITION STATE ──────────────────────────────────────
    async transition(tripId: string, userId: string, toState: string): Promise<void> {
        await tripStateMachine.transition(tripId, userId, toState as any);
    },

    // ── GET TRIP TIMELINE ─────────────────────────────────────
    async getTimeline(tripId: string, cursor?: string, limit = 20) {
        try {
            const url = `${process.env.POST_SERVICE_URL}/v1/posts/trip/${tripId}/timeline` +
                `?limit=${limit}${cursor ? '&cursor=' + cursor : ''}`;
            const res = await fetch(url);
            if (!res.ok) return { posts: [], nextCursor: null };
            return (await res.json() as any).data;
        } catch { return { posts: [], nextCursor: null }; }
    },
};

interface CreateTripDTO {
    title: string; description?: string;
    origin?: any; destination?: any;
    dates?: { start: Date; end: Date; timezone?: string };
    budget?: any; visibility?: string;
    tags?: string[]; maxCollaborators?: number;
}
interface UpdateTripDTO {
    title?: string; description?: string;
    dates?: any; budget?: any; visibility?: string;
    tags?: string[]; coverMediaUrl?: string;
}

