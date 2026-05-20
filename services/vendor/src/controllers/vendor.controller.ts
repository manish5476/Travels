import { Request, Response } from 'express';
import { VendorService } from '../services/vendor.service';

export class VendorController {
  static async createVendor(req: Request, res: Response) {
    const ownerId = (req as any).user?.id || req.body.owner_user_id; // fallback if no auth
    const vendorData = { ...req.body, owner_user_id: ownerId };
    const vendor = await VendorService.create(vendorData);
    res.status(201).json(vendor);
  }

  static async updateInventory(req: Request, res: Response) {
    const { id } = req.params;
    const { inventoryCount } = req.body;
    const vendor = await VendorService.updateInventory(id, inventoryCount);
    res.status(200).json(vendor);
  }

  static async searchVendors(req: Request, res: Response) {
    const { category, city } = req.query;
    const vendors = await VendorService.search(category as string, city as string);
    res.status(200).json(vendors);
  }
}
