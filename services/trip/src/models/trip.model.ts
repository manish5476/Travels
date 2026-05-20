
import mongoose, { Schema, Document } from 'mongoose';

export type TripStatus = 'draft' | 'planning' | 'active' | 'completed' | 'archived' | 'cancelled';
export type TripRole = 'admin' | 'co-admin' | 'member' | 'viewer';
export type TravelMode = 'flight' | 'train' | 'car' | 'boat' | 'walk' | 'bus' | 'bicycle';

export interface ICollaborator {
    userId: mongoose.Types.ObjectId;
    role: TripRole;
    status: 'invited' | 'active' | 'left' | 'removed';
    joinedAt?: Date;
    contributionScore: number;
}

export interface IJoinRequest {
    userId: mongoose.Types.ObjectId;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Date;
}

export interface IWaypoint {
    order: number;
    location: { type: 'Point'; coordinates: [number, number] };
    label: string;
    travelMode: TravelMode;
    estimatedArrival?: Date;
    actualArrival?: Date;
    notes?: string;
    linkedPostIds: mongoose.Types.ObjectId[];
}

export interface IPackingItem {
    _id: mongoose.Types.ObjectId;
    item: string;
    category: string;
    assignedTo?: mongoose.Types.ObjectId;
    packed: boolean;
    addedBy: mongoose.Types.ObjectId;
    isAiSuggested: boolean;
}

export interface IAiItineraryItem {
    time: string;
    activity: string;
    description?: string;
    placeId?: string;
    vendorId?: mongoose.Types.ObjectId;
    estimatedCost?: number;
    durationMin?: number;
    bookingPossible: boolean;
    votes: { up: mongoose.Types.ObjectId[]; down: mongoose.Types.ObjectId[] };
}

export interface ITrip extends Document {
    _id: mongoose.Types.ObjectId;
    slug: string;
    title: string;
    description?: string;
    coverMediaUrl?: string;
    adminId: mongoose.Types.ObjectId;
    collaborators: ICollaborator[];
    joinRequests: IJoinRequest[];
    maxCollaborators: number;
    origin: { type: 'Point'; coordinates: [number, number]; label: string; placeId?: string } | null;
    destination: { type: 'Point'; coordinates: [number, number]; label: string; placeId?: string } | null;
    waypoints: IWaypoint[];
    dates: { start: Date; end: Date; timezone: string };
    durationDays: number;
    budget: { estimated: number; actual: number; currency: string; perPerson: number };
    status: TripStatus;
    visibility: 'private' | 'friends_only' | 'public';
    tags: string[];
    postCount: number;
    totalKm: number;
    groupChatId?: mongoose.Types.ObjectId;
    packingList: IPackingItem[];
    aiItinerary: Array<{ day: number; items: IAiItineraryItem[] }>;
    safety: {
        sosContacts: Array<{ name: string; phone: string }>;
        checkinIntervalHours?: number;
        emergencyMode: boolean;
        trustedContactToken?: string;
        trustedContactExpiry?: Date;
    };
    memoryReelUrl?: string;
    memoryReelStatus: 'not_started' | 'processing' | 'ready' | 'failed';
    completedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const WaypointSchema = new Schema({
    order: { type: Number, required: true },
    location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
    label: { type: String, required: true, maxlength: 200 },
    travelMode: { type: String, enum: ['flight', 'train', 'car', 'boat', 'walk', 'bus', 'bicycle'], default: 'car' },
    estimatedArrival: Date,
    actualArrival: Date,
    notes: { type: String, maxlength: 500 },
    linkedPostIds: [{ type: Schema.Types.ObjectId }],
}, { _id: false });

const TripSchema = new Schema<ITrip>({
    slug: { type: String, unique: true, required: true, index: true },
    title: { type: String, required: true, maxlength: 80, trim: true },
    description: { type: String, maxlength: 500 },
    coverMediaUrl: String,
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    collaborators: [{
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'co-admin', 'member', 'viewer'], default: 'member' },
        status: { type: String, enum: ['invited', 'active', 'left', 'removed'], default: 'invited' },
        joinedAt: Date,
        contributionScore: { type: Number, default: 0 },
    }],
    joinRequests: [{
        userId: { type: Schema.Types.ObjectId, required: true },
        message: String,
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        requestedAt: { type: Date, default: Date.now },
    }],
    maxCollaborators: { type: Number, default: 20, max: 50 },
    origin: Schema.Types.Mixed,
    destination: Schema.Types.Mixed,
    waypoints: [WaypointSchema],
    dates: { start: Date, end: Date, timezone: { type: String, default: 'Asia/Kolkata' } },
    durationDays: { type: Number, default: 0 },
    budget: {
        estimated: { type: Number, default: 0 },
        actual: { type: Number, default: 0 },
        currency: { type: String, default: 'INR' },
        perPerson: { type: Number, default: 0 },
    },
    status: { type: String, enum: ['draft', 'planning', 'active', 'completed', 'archived', 'cancelled'], default: 'draft', index: true },
    visibility: { type: String, enum: ['private', 'friends_only', 'public'], default: 'private', index: true },
    tags: [{ type: String, lowercase: true, trim: true }],
    postCount: { type: Number, default: 0 },
    totalKm: { type: Number, default: 0 },
    groupChatId: Schema.Types.ObjectId,
    packingList: [{
        item: { type: String, required: true, maxlength: 200 },
        category: { type: String, default: 'general' },
        assignedTo: Schema.Types.ObjectId,
        packed: { type: Boolean, default: false },
        addedBy: { type: Schema.Types.ObjectId, required: true },
        isAiSuggested: { type: Boolean, default: false },
    }],
    aiItinerary: Schema.Types.Mixed,
    safety: {
        sosContacts: [{ name: String, phone: String }],
        checkinIntervalHours: Number,
        emergencyMode: { type: Boolean, default: false },
        trustedContactToken: String,
        trustedContactExpiry: Date,
    },
    memoryReelUrl: String,
    memoryReelStatus: { type: String, enum: ['not_started', 'processing', 'ready', 'failed'], default: 'not_started' },
    completedAt: Date,
}, { timestamps: true, versionKey: false });

TripSchema.index({ 'destination': '2dsphere' });
TripSchema.index({ 'dates.start': 1 });
TripSchema.index({ status: 1, visibility: 1 });
TripSchema.index({ adminId: 1, status: 1 });
TripSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Trip = mongoose.model<ITrip>('Trip', TripSchema);

