import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  trip_id?: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  vendor_id: mongoose.Types.ObjectId;
  catalog_item_id: string;
  guests: {
    user_id?: mongoose.Types.ObjectId;
    name: string;
    age: number;
  }[];
  dates: {
    check_in?: Date;
    check_out?: Date;
    date?: Date;
    duration_hours?: number;
  };
  amount: {
    subtotal: number;
    platform_fee: number;
    tax: number;
    total: number;
    currency: string;
  };
  payment_id?: string;
  status: 'pending_payment' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'refunded';
  qr_code_url?: string;
  cancellation_policy?: {
    deadline: Date;
    refund_percent: number;
  };
  review_id?: mongoose.Types.ObjectId;
  confirmed_at?: Date;
}

const BookingSchema = new Schema<IBooking>({
  trip_id: { type: Schema.Types.ObjectId },
  user_id: { type: Schema.Types.ObjectId, required: true },
  vendor_id: { type: Schema.Types.ObjectId, required: true },
  catalog_item_id: { type: String, required: true },
  guests: [{
    user_id: { type: Schema.Types.ObjectId },
    name: { type: String, required: true },
    age: { type: Number, required: true }
  }],
  dates: {
    check_in: Date,
    check_out: Date,
    date: Date,
    duration_hours: Number
  },
  amount: {
    subtotal: { type: Number, required: true },
    platform_fee: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' }
  },
  payment_id: String,
  status: { 
    type: String, 
    enum: ['pending_payment', 'pending', 'confirmed', 'active', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  qr_code_url: String,
  cancellation_policy: {
    deadline: Date,
    refund_percent: Number
  },
  review_id: { type: Schema.Types.ObjectId },
  confirmed_at: Date
}, {
  timestamps: true
});

BookingSchema.index({ user_id: 1 });
BookingSchema.index({ vendor_id: 1 });
BookingSchema.index({ trip_id: 1 });
BookingSchema.index({ status: 1 });

export const Booking = mongoose.model<IBooking>('Booking', BookingSchema);
