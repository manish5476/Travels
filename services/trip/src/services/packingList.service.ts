
import mongoose from 'mongoose';
import { Trip } from '../models/trip.model';

// AI-generated packing suggestions by destination type
const PACKING_TEMPLATES: Record<string, Array<{ item: string; category: string }>> = {
    beach: [
        { item: 'Sunscreen SPF 50+', category: 'health' },
        { item: 'Swimwear (2 sets)', category: 'clothing' },
        { item: 'Beach towel', category: 'gear' },
        { item: 'Flip flops', category: 'clothing' },
        { item: 'Sunglasses', category: 'accessories' },
        { item: 'After-sun lotion', category: 'health' },
    ],
    mountains: [
        { item: 'Warm jacket', category: 'clothing' },
        { item: 'Thermal innerwear', category: 'clothing' },
        { item: 'Trekking shoes', category: 'clothing' },
        { item: 'First aid kit', category: 'health' },
        { item: 'Torch + batteries', category: 'gear' },
        { item: 'Water bottle (1L+)', category: 'gear' },
    ],
    city: [
        { item: 'Comfortable walking shoes', category: 'clothing' },
        { item: 'Power bank', category: 'electronics' },
        { item: 'City map / offline maps', category: 'gear' },
        { item: 'Umbrella', category: 'accessories' },
    ],
    default: [
        { item: 'Valid ID / Passport', category: 'documents' },
        { item: 'Travel insurance docs', category: 'documents' },
        { item: 'Phone charger', category: 'electronics' },
        { item: 'Basic medicines', category: 'health' },
        { item: 'Cash (local currency)', category: 'finance' },
    ],
};

export const packingListService = {

    // ── PRE-POPULATE WITH AI SUGGESTIONS ─────────────────────
    async prePopulate(tripId: string, adminId: string): Promise<void> {
        const trip = await Trip.findById(tripId);
        if (!trip || trip.adminId.toString() !== adminId) throw new Error('FORBIDDEN');

        // Pick template based on trip tags
        let template = PACKING_TEMPLATES.default;
        if (trip.tags.includes('beach')) template = [...PACKING_TEMPLATES.beach, ...PACKING_TEMPLATES.default];
        if (trip.tags.includes('adventure')) template = [...PACKING_TEMPLATES.mountains, ...PACKING_TEMPLATES.default];
        if (trip.tags.includes('city')) template = [...PACKING_TEMPLATES.city, ...PACKING_TEMPLATES.default];

        const items = template.map(t => ({
            _id: new mongoose.Types.ObjectId(),
            item: t.item,
            category: t.category,
            packed: false,
            addedBy: new mongoose.Types.ObjectId(adminId),
            isAiSuggested: true,
        }));

        await Trip.updateOne({ _id: tripId }, { $push: { packingList: { $each: items } } });
    },

    // ── ADD ITEM ──────────────────────────────────────────────
    async addItem(tripId: string, userId: string, item: string, category = 'general', assignedTo?: string): Promise<void> {
        await Trip.updateOne({ _id: tripId }, {
            $push: {
                packingList: {
                    _id: new mongoose.Types.ObjectId(),
                    item: item.trim(),
                    category,
                    assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined,
                    packed: false,
                    addedBy: new mongoose.Types.ObjectId(userId),
                    isAiSuggested: false,
                }
            },
        });
    },

    // ── TOGGLE PACKED ─────────────────────────────────────────
    async togglePacked(tripId: string, userId: string, itemId: string): Promise<void> {
        const trip = await Trip.findOne(
            { _id: tripId, 'packingList._id': new mongoose.Types.ObjectId(itemId) },
            { 'packingList.$': 1 }
        );
        if (!trip) throw new Error('ITEM_NOT_FOUND');
        const current = (trip.packingList[0] as any)?.packed ?? false;

        await Trip.updateOne(
            { _id: tripId, 'packingList._id': new mongoose.Types.ObjectId(itemId) },
            { $set: { 'packingList.$.packed': !current } }
        );
    },

    // ── REMOVE ITEM ───────────────────────────────────────────
    async removeItem(tripId: string, itemId: string): Promise<void> {
        await Trip.updateOne(
            { _id: tripId },
            { $pull: { packingList: { _id: new mongoose.Types.ObjectId(itemId) } } }
        );
    },
};