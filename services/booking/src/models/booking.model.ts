import mongoose, { Schema, Document } from 'mongoose';

export interface IBooking extends Document {
  trip_id?: string;
  user_id: string;
  vendor_id: string;
  catalog_item_id: string;
  guests: { user_id?: string; name: string; age?: number }[];
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
  razorpay_order_id?: string;
  payment_id?: string;
  idempotency_key: string;   // booking_id + timestamp bucket
  status: 'pending_payment' | 'confirmed' | 'active' | 'completed' | 'cancelled' | 'refunded';
  qr_code_url?: string;
  cancellation_policy: { deadline: Date; refund_percent: number };
  review_unlocked: boolean;
  review_id?: string;
  cancellation_reason?: string;
  refund_amount?: number;
  created_at: Date;
  confirmed_at?: Date;
  checked_in_at?: Date;
  completed_at?: Date;
}

const BookingSchema = new Schema<IBooking>({
  trip_id: { type: String, index: true },
  user_id: { type: String, required: true, index: true },
  vendor_id: { type: String, required: true, index: true },
  catalog_item_id: { type: String, required: true },
  guests: [{ user_id: String, name: String, age: Number }],
  dates: {
    check_in: Date, check_out: Date, date: Date, duration_hours: Number,
  },
  amount: {
    subtotal: { type: Number, required: true },
    platform_fee: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
  },
  razorpay_order_id: String,
  payment_id: String,
  idempotency_key: { type: String, unique: true },
  status: {
    type: String,
    enum: ['pending_payment', 'confirmed', 'active', 'completed', 'cancelled', 'refunded'],
    default: 'pending_payment',
    index: true,
  },
  qr_code_url: String,
  cancellation_policy: { deadline: Date, refund_percent: Number },
  review_unlocked: { type: Boolean, default: false },
  review_id: String,
  cancellation_reason: String,
  refund_amount: Number,
  confirmed_at: Date,
  checked_in_at: Date,
  completed_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

BookingSchema.index({ user_id: 1, status: 1 });
BookingSchema.index({ vendor_id: 1, status: 1 });
BookingSchema.index({ trip_id: 1 });
BookingSchema.index({ razorpay_order_id: 1 });

export const BookingModel = mongoose.model<IBooking>('Booking', BookingSchema);
