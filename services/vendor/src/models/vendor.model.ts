import mongoose, { Schema, Document } from 'mongoose';

export interface ICatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  unit: 'per_night' | 'per_trip' | 'per_person' | 'per_hour';
  availability_calendar: Record<string, 'available' | 'booked' | 'blocked'>;
  max_guests: number;
  active: boolean;
}

export interface IVendor extends Document {
  owner_user_id: string;
  business_name: string;
  category: 'hotel' | 'cab' | 'tour_guide' | 'restaurant' | 'activity' | 'shop';
  description?: string;
  media: { url: string; type: string; blur_hash?: string }[];
  location: {
    type: 'Point';
    coordinates: [number, number];   // [lng, lat]
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  geofence_radius_km: number;
  service_area?: { type: 'Polygon'; coordinates: number[][][] };
  catalog: ICatalogItem[];
  operating_hours: Record<string, { open: string; close: string }>;
  rating: { average: number; count: number; breakdown: Record<string, number> };
  kyc: {
    status: 'none' | 'pending' | 'verified' | 'rejected';
    aadhaar_verified: boolean;
    gst_number?: string;
    pan_verified: boolean;
    reviewed_at?: Date;
  };
  bank_details_ref: string;   // Secrets Manager key — never raw data
  subscription_tier: 'free' | 'basic' | 'growth' | 'premium';
  is_active: boolean;
  booking_count: number;
  response_rate: number;
  created_at: Date;
  updated_at: Date;
}

const CatalogItemSchema = new Schema<ICatalogItem>({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 500 },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'INR' },
  unit: { type: String, enum: ['per_night', 'per_trip', 'per_person', 'per_hour'], required: true },
  availability_calendar: { type: Map, of: String, default: {} },
  max_guests: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
}, { _id: false });

const VendorSchema = new Schema<IVendor>({
  owner_user_id: { type: String, required: true, index: true },
  business_name: { type: String, required: true, maxlength: 100 },
  category: { type: String, required: true, enum: ['hotel', 'cab', 'tour_guide', 'restaurant', 'activity', 'shop'], index: true },
  description: { type: String, maxlength: 1000 },
  media: [{ url: String, type: String, blur_hash: String }],
  location: {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: String, city: String, state: String, pincode: String,
  },
  geofence_radius_km: { type: Number, default: 5, min: 1, max: 50 },
  service_area: {
    type: { type: String, enum: ['Polygon'] },
    coordinates: { type: [[[Number]]] },
  },
  catalog: [CatalogItemSchema],
  operating_hours: { type: Map, of: { open: String, close: String }, default: {} },
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
    breakdown: { type: Map, of: Number, default: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
  },
  kyc: {
    status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'pending' },
    aadhaar_verified: { type: Boolean, default: false },
    gst_number: String,
    pan_verified: { type: Boolean, default: false },
    reviewed_at: Date,
  },
  bank_details_ref: { type: String, required: true },
  subscription_tier: { type: String, enum: ['free', 'basic', 'growth', 'premium'], default: 'free', index: true },
  is_active: { type: Boolean, default: true, index: true },
  booking_count: { type: Number, default: 0 },
  response_rate: { type: Number, default: 100, min: 0, max: 100 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Geospatial indexes
VendorSchema.index({ location: '2dsphere' });
VendorSchema.index({ service_area: '2dsphere' });
VendorSchema.index({ category: 1, is_active: 1, 'rating.average': -1 });
VendorSchema.index({ subscription_tier: 1, is_active: 1 });
VendorSchema.index({ business_name: 'text', description: 'text', 'location.city': 'text' });

export const VendorModel = mongoose.model<IVendor>('Vendor', VendorSchema);















// import mongoose, { Schema, Document } from 'mongoose';

// export interface IVendor extends Document {
//   owner_user_id: mongoose.Types.ObjectId;
//   business_name: string;
//   category: 'hotel' | 'cab' | 'tour_guide' | 'restaurant' | 'activity' | 'shop';
//   description: string;
//   location: {
//     type: 'Point';
//     coordinates: number[];
//     address?: string;
//     city?: string;
//     state?: string;
//     pincode?: string;
//   };
//   catalog: any[];
//   kyc: {
//     status: string;
//     aadhaar_verified: boolean;
//     pan_verified: boolean;
//   };
//   subscription_tier: 'free' | 'basic' | 'growth' | 'premium';
//   is_active: boolean;
//   pricing: {
//     basePrice: number;
//     currency: string;
//   };
//   inventoryCount: number;
// }

// const VendorSchema = new Schema<IVendor>({
//   owner_user_id: { type: Schema.Types.ObjectId, required: true },
//   business_name: { type: String, required: true },
//   category: { 
//     type: String, 
//     enum: ['hotel', 'cab', 'tour_guide', 'restaurant', 'activity', 'shop'],
//     required: true
//   },
//   description: { type: String, default: '' },
//   location: {
//     type: { type: String, enum: ['Point'], default: 'Point' },
//     coordinates: { type: [Number], required: true },
//     address: String,
//     city: String,
//     state: String,
//     pincode: String
//   },
//   catalog: [{ type: Schema.Types.Mixed }],
//   kyc: {
//     status: { type: String, default: 'pending' },
//     aadhaar_verified: { type: Boolean, default: false },
//     pan_verified: { type: Boolean, default: false }
//   },
//   subscription_tier: { 
//     type: String, 
//     enum: ['free', 'basic', 'growth', 'premium'], 
//     default: 'free' 
//   },
//   is_active: { type: Boolean, default: true },
//   pricing: {
//     basePrice: { type: Number, required: true },
//     currency: { type: String, default: 'INR' }
//   },
//   inventoryCount: { type: Number, default: 0 }
// }, {
//   timestamps: true
// });

// VendorSchema.index({ location: '2dsphere' });
// VendorSchema.index({ owner_user_id: 1 });

// export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);
