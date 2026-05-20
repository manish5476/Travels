import mongoose, { Schema, Document } from 'mongoose';

export interface IVendor extends Document {
  owner_user_id: mongoose.Types.ObjectId;
  business_name: string;
  category: 'hotel' | 'cab' | 'tour_guide' | 'restaurant' | 'activity' | 'shop';
  description: string;
  location: {
    type: 'Point';
    coordinates: number[];
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  catalog: any[];
  kyc: {
    status: string;
    aadhaar_verified: boolean;
    pan_verified: boolean;
  };
  subscription_tier: 'free' | 'basic' | 'growth' | 'premium';
  is_active: boolean;
  pricing: {
    basePrice: number;
    currency: string;
  };
  inventoryCount: number;
}

const VendorSchema = new Schema<IVendor>({
  owner_user_id: { type: Schema.Types.ObjectId, required: true },
  business_name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['hotel', 'cab', 'tour_guide', 'restaurant', 'activity', 'shop'],
    required: true
  },
  description: { type: String, default: '' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
    address: String,
    city: String,
    state: String,
    pincode: String
  },
  catalog: [{ type: Schema.Types.Mixed }],
  kyc: {
    status: { type: String, default: 'pending' },
    aadhaar_verified: { type: Boolean, default: false },
    pan_verified: { type: Boolean, default: false }
  },
  subscription_tier: { 
    type: String, 
    enum: ['free', 'basic', 'growth', 'premium'], 
    default: 'free' 
  },
  is_active: { type: Boolean, default: true },
  pricing: {
    basePrice: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  inventoryCount: { type: Number, default: 0 }
}, {
  timestamps: true
});

VendorSchema.index({ location: '2dsphere' });
VendorSchema.index({ owner_user_id: 1 });

export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);
