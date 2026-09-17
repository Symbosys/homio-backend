import { vendorRepo } from "../repos/vendor.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";

export class VendorService {
  async createVendor(organizationId: string, data: any) {
    const existing = await vendorRepo.findByName(data.name, organizationId);
    if (existing) {
      throw new ErrorResponse(`Vendor with name '${data.name}' already exists in your organization`, statusCode.Conflict);
    }

    return vendorRepo.create({
      ...data,
      organizationId,
    });
  }

  async getVendors(organizationId: string, params: {
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await vendorRepo.findMany({
      organizationId,
      ...filters,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVendorById(id: string, organizationId: string) {
    const vendor = await vendorRepo.findById(id, organizationId);
    if (!vendor) {
      throw new ErrorResponse("Vendor not found", statusCode.Not_Found);
    }
    return vendor;
  }

  async updateVendor(id: string, organizationId: string, data: any) {
    const existing = await vendorRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Vendor not found", statusCode.Not_Found);
    }

    if (data.name && data.name !== existing.name) {
      const duplicate = await vendorRepo.findByName(data.name, organizationId);
      if (duplicate) {
        throw new ErrorResponse(`Vendor with name '${data.name}' already exists in your organization`, statusCode.Conflict);
      }
    }

    return vendorRepo.update(id, organizationId, data);
  }

  async deleteVendor(id: string, organizationId: string) {
    const existing = await vendorRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Vendor not found", statusCode.Not_Found);
    }

    return vendorRepo.softDelete(id, organizationId);
  }
}

export const vendorService = new VendorService();
