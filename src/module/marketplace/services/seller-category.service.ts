import { sellerCategoryRepo } from "../repos/seller-category.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type MarketplaceType } from "../../../types/types.js";

/**
 * Service orchestrating organization category seller management,
 * automated category commission assignment, and platform admin commission overrides.
 */
export class SellerCategoryService {
  /**
   * Register intent for an organization to sell in a master category.
   * Auto-approved with commission rate inherited from the master marketplace category.
   *
   * @param organizationId - ID of the organization registering
   * @param categoryId - UUID of the master MarketplaceCategory
   */
  async registerCategory(organizationId: string, categoryId: string) {
    const category = await categoryRepo.findById(categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    const existing = await sellerCategoryRepo.findByOrgAndCategory(organizationId, categoryId);
    if (existing) {
      if (!existing.isActive) {
        return sellerCategoryRepo.update(existing.id, {
          isActive: true,
          isApproved: true,
          ...(existing.commissionRate == null ? { commissionRate: category.commissionRate } : {}),
        });
      }
      throw new ErrorResponse("Your organization is already registered for this category", statusCode.Conflict);
    }

    return sellerCategoryRepo.create({
      organizationId,
      categoryId,
      marketplaceType: category.marketplaceType,
      isApproved: true,
      isActive: true,
      commissionRate: category.commissionRate,
    });
  }

  /**
   * Automatically ensures that an OrganizationMarketplaceCategory record exists for the given organization and category.
   * Triggered whenever an organization creates any product under a category.
   *
   * 1. If no record exists: creates one with isApproved: true, isActive: true, and commissionRate inherited from the category.
   * 2. If record exists without commissionRate: initializes commissionRate from category and ensures isActive & isApproved.
   * 3. If record exists with an existing commissionRate (e.g. manually customized by platform admin): preserves custom rate.
   *
   * @param organizationId - ID of the organization creating the product
   * @param categoryId - UUID of the master MarketplaceCategory
   */
  async ensureOrganizationCategoryCommission(organizationId: string, categoryId: string) {
    const category = await categoryRepo.findById(categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    const existing = await sellerCategoryRepo.findByOrgAndCategory(organizationId, categoryId);
    if (!existing) {
      return sellerCategoryRepo.create({
        organizationId,
        categoryId: category.id,
        marketplaceType: category.marketplaceType,
        isApproved: true,
        isActive: true,
        commissionRate: category.commissionRate,
      });
    }

    const updateData: {
      commissionRate?: any;
      isActive?: boolean;
      isApproved?: boolean;
    } = {};

    if (existing.commissionRate === null || existing.commissionRate === undefined) {
      updateData.commissionRate = category.commissionRate;
    }
    if (!existing.isActive) {
      updateData.isActive = true;
    }
    if (!existing.isApproved) {
      updateData.isApproved = true;
    }

    if (Object.keys(updateData).length > 0) {
      return sellerCategoryRepo.update(existing.id, updateData);
    }

    return existing;
  }

  /**
   * Fetch paginated list of seller category assignments with tenant or vertical filtering
   */
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

  /**
   * Fetch single seller category record by ID
   */
  async getSellerCategoryById(id: string) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record) {
      throw new ErrorResponse("Seller category record not found", statusCode.Not_Found);
    }
    return record;
  }

  /**
   * Platform Admin: Manually edit commission rate for an organization marketplace category.
   * Only platform admin accounts have permission to perform this override.
   *
   * @param id - UUID of the OrganizationMarketplaceCategory record
   * @param commissionRate - New commission rate percentage (0 - 100)
   */
  async updateSellerCategoryCommission(id: string, commissionRate: number) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record) {
      throw new ErrorResponse("Seller category record not found", statusCode.Not_Found);
    }

    return sellerCategoryRepo.update(id, {
      commissionRate,
    });
  }

  /**
   * Deregister or delete an organization marketplace category record
   */
  async removeSellerCategory(id: string, organizationId: string) {
    const record = await sellerCategoryRepo.findById(id);
    if (!record || record.organizationId !== organizationId) {
      throw new ErrorResponse("Seller category record not found or access denied", statusCode.Not_Found);
    }

    return sellerCategoryRepo.delete(id);
  }
}

export const sellerCategoryService = new SellerCategoryService();
