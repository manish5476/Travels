import { Request, Response, NextFunction } from 'express';
import { vendorService } from '../services/vendor.service';

export const vendorController = {

  async createVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = await vendorService.createVendor(req.user!.userId, req.body);
      res.status(201).json({ success: true, data: vendor });
    } catch (e) { next(e); }
  },

  async getVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = await vendorService.getVendorById(req.params.id);
      res.json({ success: true, data: vendor });
    } catch (e) { next(e); }
  },

  async updateVendor(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = await vendorService.updateVendor(req.params.id, req.user!.userId, req.body);
      res.json({ success: true, data: vendor });
    } catch (e) { next(e); }
  },

  async searchNearby(req: Request, res: Response, next: NextFunction) {
    try {
      const { lat, lng, radius = '10', category, page = '1', limit = '20' } = req.query as any;
      const result = await vendorService.searchNearby(
        parseFloat(lng), parseFloat(lat), parseFloat(radius),
        category, parseInt(page), parseInt(limit)
      );
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  },

  async checkAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { item_id, start_date, end_date } = req.query as any;
      const result = await vendorService.checkAvailability(req.params.id, item_id, start_date, end_date);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async upsertCatalogItem(req: Request, res: Response, next: NextFunction) {
    try {
      const catalog = await vendorService.upsertCatalogItem(req.params.id, req.user!.userId, req.body);
      res.json({ success: true, data: catalog });
    } catch (e) { next(e); }
  },

  async blockDates(req: Request, res: Response, next: NextFunction) {
    try {
      const { catalog_item_id, dates, status = 'blocked' } = req.body;
      const result = await vendorService.blockDates(req.params.id, req.user!.userId, catalog_item_id, dates, status);
      res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { cursor, limit = '20' } = req.query as any;
      const result = await vendorService.getReviews(req.params.id, cursor, parseInt(limit));
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  },

  async submitReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { vendor_id, booking_id, rating, text, media_urls } = req.body;
      const review = await vendorService.submitReview(
        req.user!.userId, vendor_id, booking_id, rating, text, media_urls
      );
      res.status(201).json({ success: true, data: review });
    } catch (e) { next(e); }
  },

  async replyToReview(req: Request, res: Response, next: NextFunction) {
    try {
      const review = await vendorService.replyToReview(
        req.params.review_id, req.user!.userId, req.body.reply_text
      );
      res.json({ success: true, data: review });
    } catch (e) { next(e); }
  },

  // Internal endpoint — called by booking service after payment confirmed
  async markDateBooked(req: Request, res: Response, next: NextFunction) {
    try {
      const { vendor_id, catalog_item_id, dates } = req.body;
      await vendorService.markDateBooked(vendor_id, catalog_item_id, dates);
      res.json({ success: true });
    } catch (e) { next(e); }
  },

  async updateKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const vendor = await vendorService.updateKycStatus(
        req.params.id, req.body.status, req.body.gst_number
      );
      res.json({ success: true, data: vendor });
    } catch (e) { next(e); }
  },
};


// import { Request, Response } from 'express';
// import { VendorService } from '../services/vendor.service';

// export class VendorController {
//   static async createVendor(req: Request, res: Response) {
//     const ownerId = (req as any).user?.id || req.body.owner_user_id; // fallback if no auth
//     const vendorData = { ...req.body, owner_user_id: ownerId };
//     const vendor = await VendorService.create(vendorData);
//     res.status(201).json(vendor);
//   }

//   static async updateInventory(req: Request, res: Response) {
//     const { id } = req.params;
//     const { inventoryCount } = req.body;
//     const vendor = await VendorService.updateInventory(id, inventoryCount);
//     res.status(200).json(vendor);
//   }

//   static async searchVendors(req: Request, res: Response) {
//     const { category, city } = req.query;
//     const vendors = await VendorService.search(category as string, city as string);
//     res.status(200).json(vendors);
//   }
// }
