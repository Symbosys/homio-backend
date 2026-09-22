import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { MarketplaceType } from "../../../types/types.js";

export class CategoryRepository {
  async create(data: {
    name: string;
    code: string;
    slug: string;
    marketplaceType: MarketplaceType;
    description?: string | null;
    icon?: string | null;
    imageUrl?: any;
    sortOrder?: number;
    parentId?: string | null;
    isActive?: boolean;
    commissionRate?: number | string | Prisma.Decimal;
  }) {
    const { imageUrl, parentId, commissionRate, ...rest } = data;
    return prisma.marketplaceCategory.create({
      data: {
        ...rest,
        ...(parentId ? { parentId } : {}),
        ...(commissionRate !== undefined ? { commissionRate } : {}),
        ...(imageUrl !== undefined && imageUrl !== null
          ? { imageUrl: imageUrl as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async findById(id: string) {
    return prisma.marketplaceCategory.findFirst({
      where: { id, isDeleted: false },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: {
          where: { isDeleted: false },
          select: { id: true, name: true, slug: true, code: true, icon: true, isActive: true },
        },
      },
    });
  }

  async findBySlug(slug: string, marketplaceType: MarketplaceType) {
    return prisma.marketplaceCategory.findFirst({
      where: { slug, marketplaceType, isDeleted: false },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        children: { where: { isDeleted: false } },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.marketplaceCategory.findFirst({
      where: { code, isDeleted: false },
    });
  }

  async findMany(params: {
    marketplaceType?: MarketplaceType;
    parentId?: string | null;
    search?: string;
    isActive?: boolean;
    skip: number;
    take: number;
  }) {
    const { marketplaceType, parentId, search, isActive, skip, take } = params;

    const where: any = { isDeleted: false };
    if (marketplaceType) where.marketplaceType = marketplaceType;
    if (parentId !== undefined) where.parentId = parentId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.marketplaceCategory.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          parent: { select: { id: true, name: true, slug: true } },
          _count: {
            select: {
              children: { where: { isDeleted: false } },
              digitalProducts: { where: { isDeleted: false } },
              homeDecorProducts: { where: { isDeleted: false } },
              propertyListings: { where: { isDeleted: false } },
              materialProducts: { where: { isDeleted: false } },
            },
          },
        },
      }),
      prisma.marketplaceCategory.count({ where }),
    ]);

    return { items, total };
  }

  async getTree(marketplaceType?: MarketplaceType) {
    const where: any = {
      isDeleted: false,
      parentId: null,
    };
    if (marketplaceType) where.marketplaceType = marketplaceType;

    return prisma.marketplaceCategory.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      include: {
        children: {
          where: { isDeleted: false },
          orderBy: { sortOrder: "asc" },
          include: {
            children: {
              where: { isDeleted: false },
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: any) {
    const { imageUrl, parentId, ...rest } = data;
    return prisma.marketplaceCategory.update({
      where: { id },
      data: {
        ...rest,
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
        ...(imageUrl !== undefined
          ? { imageUrl: imageUrl === null ? Prisma.DbNull : (imageUrl as Prisma.InputJsonValue) }
          : {}),
      },
      include: {
        parent: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async softDelete(id: string) {
    return prisma.marketplaceCategory.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const categoryRepo = new CategoryRepository();
