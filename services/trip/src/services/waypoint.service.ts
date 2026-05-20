
import mongoose from 'mongoose';
import { Trip, IWaypoint, TravelMode } from '../models/trip.model';
import { publishTripEvent } from '../utils/kafkaPublisher';

export const waypointService = {

    // ── ADD WAYPOINT ──────────────────────────────────────────
    async add(tripId: string, userId: string, data: {
        location: { type: 'Point'; coordinates: [number, number] };
        label: string;
        travelMode: TravelMode;
        estimatedArrival?: Date;
        notes?: string;
    }): Promise<IWaypoint> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('TRIP_NOT_FOUND');

        const order = trip.waypoints.length > 0
            ? Math.max(...trip.waypoints.map(w => w.order)) + 1
            : 1;

        const waypoint: IWaypoint = {
            order, label: data.label, travelMode: data.travelMode,
            location: data.location, estimatedArrival: data.estimatedArrival,
            notes: data.notes, linkedPostIds: [],
        };

        await Trip.updateOne({ _id: tripId }, { $push: { waypoints: waypoint } });
        return waypoint;
    },

    // ── CHECK IN ──────────────────────────────────────────────
    async checkIn(tripId: string, userId: string, waypointIndex: number): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('TRIP_NOT_FOUND');
        if (trip.status !== 'active') throw new Error('TRIP_NOT_ACTIVE');

        await Trip.updateOne(
            { _id: tripId },
            { $set: { [`waypoints.${waypointIndex}.actualArrival`]: new Date() } }
        );

        const wp = trip.waypoints[waypointIndex];
        publishTripEvent('trip.waypoint_checkin', {
            tripId, userId,
            waypointLabel: wp?.label,
            location: wp?.location,
            checkedInAt: new Date().toISOString(),
        });
    },

    // ── REORDER ───────────────────────────────────────────────
    async reorder(tripId: string, adminId: string, orderedIds: number[]): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        const reordered = orderedIds.map((originalOrder, newIdx) => {
            const wp = trip.waypoints.find(w => w.order === originalOrder);
            return wp ? { ...wp, order: newIdx + 1 } : null;
        }).filter(Boolean);

        await Trip.updateOne({ _id: tripId }, { $set: { waypoints: reordered } });
    },
};
