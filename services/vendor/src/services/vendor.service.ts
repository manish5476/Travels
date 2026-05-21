import { v4 as uuidv4 } from 'uuid';
import { VendorModel, ICatalogItem } from '../models/vendor.model';
import { ReviewModel } from '../models/review.model';
import { redis } from '../config/redis';
import { publishEvent } from '@tripparty/shared';
import { Errors } from '@tripparty/shared';
import { logger } from '@tripparty/shared';
 
// ── Cache helpers ─────────────────────────────────────────────────────────
const VENDOR_CACHE_TTL = 3600; // 1 hour
const cacheKey = (id: string) => `vendor:profile:${id}`;
 
export const vendorService = {
 
  // ── Create vendor (vendor registers) ──────────────────────────────────
  async createVendor(owner_user_id: string, data: Partial<typeof VendorModel.prototype>) {
    const vendor = await VendorModel.create({
      ...data,
      owner_user_id,
      kyc: { status: 'pending', aadhaar_verified: false, pan_verified: false },
      bank_details_ref: `secrets/vendors/${owner_user_id}/bank`, // placeholder key
    });
    await publishEvent('vendor.registered', vendor._id.toString(), {
      vendor_id: vendor._id, owner_user_id, business_name: vendor.business_name,
      category: vendor.category, city: vendor.location?.city,
    });
    logger.info({ vendor_id: vendor._id }, 'Vendor created');
    return vendor;
  },
 
  // ── Get vendor by ID (with cache) ─────────────────────────────────────
  async getVendorById(vendorId: string) {
    const cached = await redis.get(cacheKey(vendorId));
    if (cached) return JSON.parse(cached);
 
    const vendor = await VendorModel.findById(vendorId).lean();
    if (!vendor) throw Errors.notFound('Vendor');
 
    await redis.setex(cacheKey(vendorId), VENDOR_CACHE_TTL, JSON.stringify(vendor));
    return vendor;
  },
 
  // ── Update vendor profile ─────────────────────────────────────────────
  async updateVendor(vendorId: string, ownerId: string, updates: any) {
    const vendor = await VendorModel.findOne({ _id: vendorId, owner_user_id: ownerId });
    if (!vendor) throw Errors.notFound('Vendor');
 
    // Never allow updating fields that need admin/KYC review
    delete updates.kyc;
    delete updates.bank_details_ref;
    delete updates.rating;
    delete updates.booking_count;
    delete updates.owner_user_id;
 
    Object.assign(vendor, updates);
    await vendor.save();
    await redis.del(cacheKey(vendorId));   // bust cache
    return vendor;
  },
 
  // ── Geo search ────────────────────────────────────────────────────────
  async searchNearby(lng: number, lat: number, radiusKm: number, category?: string, page = 1, limit = 20) {
    if (isNaN(lng) || isNaN(lat)) throw Errors.badRequest('Invalid coordinates');
 
    const query: any = {
      is_active: true,
      'kyc.status': 'verified',
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusKm * 1000,
        },
      },
    };
    if (category) query.category = category;
 
    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      VendorModel.find(query)
        .select('-bank_details_ref -kyc.aadhaar_verified -kyc.pan_verified')
        .skip(skip).limit(limit).lean(),
      VendorModel.countDocuments(query),
    ]);
    return { vendors, total, page, pages: Math.ceil(total / limit) };
  },
 
  // ── Check availability for a catalog item ─────────────────────────────
  async checkAvailability(vendorId: string, catalogItemId: string, startDate: string, endDate: string) {
    const vendor = await VendorModel.findById(vendorId).lean();
    if (!vendor) throw Errors.notFound('Vendor');
 
    const item = vendor.catalog.find(c => c.id === catalogItemId);
    if (!item || !item.active) throw Errors.notFound('Catalog item');
 
    // Generate date range and check each day
    const start = new Date(startDate);
    const end   = new Date(endDate);
    const available_dates: string[] = [];
    const blocked_dates:   string[] = [];
 
    const cur = new Date(start);
    while (cur <= end) {
      const key = cur.toISOString().split('T')[0]; // 'YYYY-MM-DD'
      const status = (item.availability_calendar as any)[key] || 'available';
      if (status === 'available') available_dates.push(key);
      else blocked_dates.push(key);
      cur.setDate(cur.getDate() + 1);
    }
 
    return { catalog_item_id: catalogItemId, available_dates, blocked_dates, price: item.price, unit: item.unit };
  },
 
  // ── Add / update catalog item ─────────────────────────────────────────
  async upsertCatalogItem(vendorId: string, ownerId: string, item: ICatalogItem) {
    const vendor = await VendorModel.findOne({ _id: vendorId, owner_user_id: ownerId });
    if (!vendor) throw Errors.notFound('Vendor');
 
    const tierLimits = { free: 3, basic: 10, growth: Infinity, premium: Infinity };
    const maxItems = tierLimits[vendor.subscription_tier];
 
    const idx = vendor.catalog.findIndex(c => c.id === item.id);
    if (idx >= 0) {
      vendor.catalog[idx] = item;                           // update existing
    } else {
      if (vendor.catalog.length >= maxItems)
        throw Errors.badRequest(`Tier "${vendor.subscription_tier}" allows max ${maxItems} catalog items`);
      item.id = uuidv4();                                   // new item — generate ID
      vendor.catalog.push(item);
    }
    await vendor.save();
    await redis.del(cacheKey(vendorId));
    return vendor.catalog;
  },
 
  // ── Block dates on calendar (vendor marks unavailable) ────────────────
  async blockDates(vendorId: string, ownerId: string, catalogItemId: string, dates: string[], status: 'blocked'|'available') {
    const vendor = await VendorModel.findOne({ _id: vendorId, owner_user_id: ownerId });
    if (!vendor) throw Errors.notFound('Vendor');
 
    const item = vendor.catalog.find(c => c.id === catalogItemId);
    if (!item) throw Errors.notFound('Catalog item');
 
    for (const d of dates) {
      (item.availability_calendar as any)[d] = status;
    }
    await vendor.save();
    await redis.del(cacheKey(vendorId));
    return { updated: dates.length };
  },
 
  // ── Get reviews for vendor ────────────────────────────────────────────
  async getReviews(vendorId: string, cursor?: string, limit = 20) {
    const query: any = { vendor_id: vendorId };
    if (cursor) query.created_at = { $lt: new Date(cursor) };
 
    const reviews = await ReviewModel.find(query)
      .sort({ created_at: -1 })
      .limit(limit + 1)
      .lean();
 
    const hasMore = reviews.length > limit;
    if (hasMore) reviews.pop();
    const next_cursor = hasMore ? reviews[reviews.length - 1].created_at.toISOString() : null;
    return { reviews, next_cursor };
  },
 
  // ── Submit review (only after verified booking) ───────────────────────
  async submitReview(userId: string, vendorId: string, bookingId: string, rating: number, text?: string, media_urls: string[] = []) {
    // Review is only created after booking service sets booking.status = 'completed'
    // Booking service marks review_unlocked = true; we trust its internal call here
    const existing = await ReviewModel.findOne({ booking_id: bookingId });
    if (existing) throw Errors.conflict('Review already submitted for this booking');
 
    const review = await ReviewModel.create({
      vendor_id: vendorId, booking_id: bookingId, user_id: userId,
      rating, text, media_urls, is_verified: true,
    });
 
    // Recompute rating average atomically
    const stats = await ReviewModel.aggregate([
      { $match: { vendor_id: vendorId } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 },
          breakdown: { $push: '$rating' } } },
    ]);
 
    if (stats.length > 0) {
      const { avg, count, breakdown } = stats[0];
      const bd: Record<string,number> = { '1':0,'2':0,'3':0,'4':0,'5':0 };
      for (const r of breakdown) bd[String(r)] = (bd[String(r)] || 0) + 1;
      await VendorModel.updateOne({ _id: vendorId }, {
        'rating.average': Math.round(avg * 10) / 10,
        'rating.count': count,
        'rating.breakdown': bd,
      });
    }
    await redis.del(cacheKey(vendorId));
    return review;
  },
 
  // ── Vendor replies to a review ────────────────────────────────────────
  async replyToReview(reviewId: string, ownerId: string, replyText: string) {
    const review = await ReviewModel.findById(reviewId);
    if (!review) throw Errors.notFound('Review');
 
    // Verify vendor owns this review's vendor
    const vendor = await VendorModel.findOne({ _id: review.vendor_id, owner_user_id: ownerId });
    if (!vendor) throw Errors.forbidden();
 
    review.reply = { text: replyText, replied_at: new Date() };
    await review.save();
    return review;
  },
 
  // ── Update availability slot from booking service (internal call) ─────
  async markDateBooked(vendorId: string, catalogItemId: string, dates: string[]) {
    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) return;
    const item = vendor.catalog.find(c => c.id === catalogItemId);
    if (!item) return;
    for (const d of dates) (item.availability_calendar as any)[d] = 'booked';
    await vendor.save();
    await redis.del(cacheKey(vendorId));
  },
 
  // ── KYC approve/reject (internal admin call) ──────────────────────────
  async updateKycStatus(vendorId: string, status: 'verified'|'rejected', gst_number?: string) {
    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) throw Errors.notFound('Vendor');
    vendor.kyc.status = status;
    vendor.kyc.reviewed_at = new Date();
    if (gst_number) vendor.kyc.gst_number = gst_number;
    if (status === 'verified') {
      vendor.kyc.aadhaar_verified = true;
      vendor.kyc.pan_verified = true;
    }
    await vendor.save();
    await redis.del(cacheKey(vendorId));
    await publishEvent('vendor.kyc_updated', vendorId, { vendor_id: vendorId, status });
    return vendor;
  },
};



// import { Vendor, IVendor } from '../models/vendor.model';
// import { HttpError } from '@tripparty/shared/errors/HttpError';

// export class VendorService {
//   static async create(data: Partial<IVendor>) {
//     const vendor = new Vendor(data);
//     await vendor.save();
//     return vendor;
//   }

//   static async updateInventory(id: string, count: number) {
//     const vendor = await Vendor.findByIdAndUpdate(
//       id,
//       { $set: { inventoryCount: count } },
//       { new: true }
//     );
//     if (!vendor) {
//       throw new HttpError(404, 'Vendor not found');
//     }
//     return vendor;
//   }

//   static async search(category?: string, city?: string) {
//     const query: any = { is_active: true };
//     if (category) query.category = category;
//     if (city) query['location.city'] = city;
    
//     return Vendor.find(query).limit(20);
//   }
// }
