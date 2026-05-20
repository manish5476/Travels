import { Vendor, IVendor } from '../models/vendor.model';
import { HttpError } from '@tripparty/shared/errors/HttpError';

export class VendorService {
  static async create(data: Partial<IVendor>) {
    const vendor = new Vendor(data);
    await vendor.save();
    return vendor;
  }

  static async updateInventory(id: string, count: number) {
    const vendor = await Vendor.findByIdAndUpdate(
      id,
      { $set: { inventoryCount: count } },
      { new: true }
    );
    if (!vendor) {
      throw new HttpError(404, 'Vendor not found');
    }
    return vendor;
  }

  static async search(category?: string, city?: string) {
    const query: any = { is_active: true };
    if (category) query.category = category;
    if (city) query['location.city'] = city;
    
    return Vendor.find(query).limit(20);
  }
}
