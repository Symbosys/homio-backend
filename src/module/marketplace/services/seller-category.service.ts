import { sellerCategoryRepo } from "../repos/seller-category.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type MarketplaceType } from "../../../types/types.js";

export class SellerCategoryService {
  async registerCategory(organizationId: string, categoryId: string) {
    const category = await categoryRepo.findById(categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    const existing = await sellerCategoryRepo.findByOrgAndCategory(organizationId, categoryId);
    if (existing) {
      if (!existing.isActive) {
        return sellerCategoryRepo.update(existing.id, { isActive: true });
      }
      throw new ErrorResponse("Your organization is already registered for this category", statusCode.Conflict);
    }

    return sellerCategoryRepo.create({
      organizationId,
      categoryId,
      marketplaceType: category.marketplaceType,
      isApproved: false,
      isActive: true,
    });
  }

  async getSellerCategories(params: {
    organizationId?: string;
    marketplaceType?: MarketplaceType;
    isApproved?: boolean;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await sellerCategoryRepo.findMany({
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

  async getSellerCategoryById(id: string) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record) {
      throw new ErrorResponse("Seller category record not found", statusCode.Not_Found);
    }
    return record;
  }

  async approveSellerCategory(id: string, isApproved: boolean, commissionRate?: number | null) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record) {
      throw new ErrorResponse("Seller category record not found", statusCode.Not_Found);
    }

    return sellerCategoryRepo.update(id, {
      isApproved,
      commissionRate,
    });
  }

  async removeSellerCategory(id: string, organizationId: string) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record || record.organizationId !== organizationId) {
      throw new ErrorResponse("Seller category record not found or access denied", statusCode.Not_Found);
    }

    return sellerCategoryRepo.delete(id);
  }
}

export const sellerCategoryService = new SellerCategoryService();
