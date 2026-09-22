import { prisma } from "../../../lib/prisma.js";
import type { MarketplaceType, Prisma } from "../../../types/types.js";

/**
 * Repository for managing tenant-level category seller registrations and commission rates
 */
export class SellerCategoryRepository {
  /**
   * Create an organization marketplace category mapping with optional custom commission rate
   */
  async create(data: {
    organizationId: string;
    categoryId: string;
    marketplaceType: MarketplaceType;
    isApproved?: boolean;
    isActive?: boolean;
    commissionRate?: number | string | Prisma.Decimal | null;
  }) {
    return prisma.organizationMarketplaceCategory.create({
      data,
      include: {
        category: true,
      },
    });
  }

  async findByOrgAndCategory(organizationId: string, categoryId: string) {
    return prisma.organizationMarketplaceCategory.findUnique({
      where: {
        organizationId_categoryId: {
          organizationId,
          categoryId,
        },
      },
      include: {
        category: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.organizationMarketplaceCategory.findUnique({
      where: { id },
      include: {
        category: true,
        organization: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async findMany(params: {
    organizationId?: string;
    marketplaceType?: MarketplaceType;
    isApproved?: boolean;
    isActive?: boolean;
    skip: number;
    take: number;
  }) {
    const { organizationId, marketplaceType, isApproved, isActive, skip, take } = params;

    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (marketplaceType) where.marketplaceType = marketplaceType;
    if (isApproved !== undefined) where.isApproved = isApproved;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      prisma.organizationMarketplaceCategory.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      prisma.organizationMarketplaceCategory.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update seller category status or custom platform commission rate
   */
  async update(id: string, data: {
    isApproved?: boolean;
    isActive?: boolean;
    commissionRate?: number | string | Prisma.Decimal | null;
  }) {
    return prisma.organizationMarketplaceCategory.update({
      where: { id },
      data,
      include: {
        category: true,
      },
    });
  }

  async delete(id: string) {
    return prisma.organizationMarketplaceCategory.delete({
      where: { id },
    });
  }
}

export const sellerCategoryRepo = new SellerCategoryRepository();
