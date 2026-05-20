
import Anthropic from '@anthropic-ai/sdk';
import { Trip } from '../models/trip.model';
import { redis } from '../config/redis';
import { config } from '../config';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

interface ItineraryItem {
    time: string;
    activity: string;
    description?: string;
    placeId?: string;
    vendorId?: string;
    estimatedCost?: number;
    durationMin?: number;
    bookingPossible: boolean;
    votes: { up: string[]; down: string[] };
}

interface GeneratedItinerary {
    days: Array<{ day: number; items: ItineraryItem[] }>;
}

export const aiPlannerService = {

    // ── GENERATE ITINERARY ────────────────────────────────────
    async generate(tripId: string, regenerate = false): Promise<GeneratedItinerary> {
        const trip = await Trip.findById(tripId);
        if (!trip) throw new Error('TRIP_NOT_FOUND');

        const dest = trip.destination?.label || 'the destination';
        const days = trip.durationDays || 3;
        const groupSize = trip.collaborators.filter(c => c.status === 'active').length;
        const budgetTier = trip.budget.perPerson > 5000 ? 'luxury'
            : trip.budget.perPerson > 2000 ? 'mid' : 'budget';

        // ── CACHE CHECK ───────────────────────────────────────
        const cacheKey = `ai:itinerary:${dest}:${days}:${budgetTier}:${trip.tags.sort().join(',')}`;
        if (!regenerate) {
            const cached = await redis.get(cacheKey);
            if (cached) {
                logger.info({ tripId, cacheKey }, 'AI itinerary cache hit');
                return JSON.parse(cached);
            }
        }

        // ── FETCH REAL VENDOR DATA ────────────────────────────
        let vendorContext = '';
        try {
            const res = await fetch(
                `${config.services.vendorUrl}/internal/nearby?destination=${encodeURIComponent(dest)}&limit=10`
            );
            if (res.ok) {
                const vendors = (await res.json() as any).data || [];
                vendorContext = vendors.length > 0
                    ? `\nAvailable local vendors:\n${JSON.stringify(vendors.slice(0, 5))}`
                    : '';
            }
        } catch { /* non-fatal */ }

        // ── BUILD PROMPT ──────────────────────────────────────
        const systemPrompt = [
            'You are a travel planning assistant for Trip Party, a social travel app in India.',
            'Generate a detailed day-by-day itinerary.',
            'Return ONLY valid JSON matching this exact schema:',
            '{ "days": [{ "day": number, "items": [{ "time": "HH:MM", "activity": string, "description": string, "estimatedCost": number, "durationMin": number, "bookingPossible": boolean }] }] }',
            'No markdown. No preamble. No explanation. Pure JSON only.',
            'Use INR for all costs. Keep costs realistic for Indian travelers.',
            'All activities must be real, specific places — never generic.',
        ].join(' ');

        const userPrompt = [
            `Plan a ${days}-day trip to ${dest} for ${groupSize} people.`,
            `Budget tier: ${budgetTier} (per person budget: ₹${trip.budget.perPerson}).`,
            `Trip interests/tags: ${trip.tags.join(', ') || 'general sightseeing'}.`,
            vendorContext,
        ].join('\n');

        logger.info({ tripId, dest, days, budgetTier }, 'Calling Claude API for itinerary');

        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

        // Strip any accidental markdown fences
        const cleaned = text.replace(/```json|```/g, '').trim();
        const itinerary: GeneratedItinerary = JSON.parse(cleaned);

        // Add empty votes array to each item
        itinerary.days.forEach(day => {
            day.items.forEach(item => { item.votes = { up: [], down: [] }; });
        });

        // ── SAVE TO TRIP + CACHE ──────────────────────────────
        await Trip.updateOne({ _id: tripId }, { $set: { aiItinerary: itinerary.days } });
        await redis.setex(cacheKey, config.aiCacheTtl, JSON.stringify(itinerary));

        logger.info({ tripId, days: itinerary.days.length }, 'AI itinerary generated and cached');
        return itinerary;
    },

    // ── VOTE ON ITEM ──────────────────────────────────────────
    async vote(tripId: string, userId: string, dayIndex: number, itemIndex: number, vote: 'up' | 'down'): Promise<void> {
        const opposite = vote === 'up' ? 'down' : 'up';
        const uid = new mongoose.Types.ObjectId(userId);

        // Remove from opposite, add to this vote (atomic)
        await Trip.updateOne({ _id: tripId }, {
            $pull: { [`aiItinerary.${dayIndex}.items.${itemIndex}.votes.${opposite}`]: uid },
            $addToSet: { [`aiItinerary.${dayIndex}.items.${itemIndex}.votes.${vote}`]: uid },
        });
    },

    // ── COMMIT ITEM AS WAYPOINT ───────────────────────────────
    // Admin converts a voted-on AI suggestion into a real waypoint
    async commitAsWaypoint(tripId: string, adminId: string, dayIdx: number, itemIdx: number): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        const item = trip.aiItinerary?.[dayIdx]?.items?.[itemIdx];
        if (!item) throw new Error('ITEM_NOT_FOUND');

        const order = trip.waypoints.length + 1;
        await Trip.updateOne({ _id: tripId }, {
            $push: {
                waypoints: {
                    order, label: item.activity, travelMode: 'car',
                    location: { type: 'Point', coordinates: [0, 0] },
                    notes: item.description, linkedPostIds: [],
                }
            },
        });
    },
};
