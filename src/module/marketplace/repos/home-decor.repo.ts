import { prisma } from "../../../lib/prisma.js";
import type { ProductStatus, ProductOwnershipType, AffiliatePartner } from "../../../types/types.js";

export class HomeDecorRepository {
  async create(data: {
    organizationId: string;
    categoryId: string;
    ownershipType?: ProductOwnershipType;
    vendorId?: string | null;
    ownerCommissionRate?: number | null;
    name: string;
    sku: string;
    brandName?: string | null;
    description?: string | null;
    tags?: string[];
    material?: string | null;
    color?: string | null;
    dimensions?: string | null;
    roomType?: string | null;
    coverImageUrl?: any;
    galleryUrls?: any;
    mrp?: number;
    sellingPrice?: number;
    taxRate?: number;
    inStock?: boolean;
    stockCount?: number;
    minOrderQuantity?: number;
    sampleAvailable?: boolean;
    samplePrice?: number;
    isAffiliateEnabled?: boolean;
    affiliatePartner?: AffiliatePartner | null;
    affiliateUrl?: string | null;
    commissionRate?: number;
    status?: ProductStatus;
    isFeatured?: boolean;
  }) {
    return prisma.homeDecorProduct.create({
      data: data as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
      },
    });
  }

  async findById(id: string, organizationId?: string) {
    const where: any = { id, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;

    return prisma.homeDecorProduct.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findBySku(sku: string, organizationId: string) {
    return prisma.homeDecorProduct.findFirst({
      where: { sku, organizationId, isDeleted: false },
    });
  }

  async findMany(params: {
    organizationId?: string;
    categoryId?: string;
    vendorId?: string;
    ownershipType?: ProductOwnershipType;
    roomType?: string;
    status?: ProductStatus;
    inStock?: boolean;
    search?: string;
    skip: number;
    take: number;
  }) {
    const { organizationId, categoryId, vendorId, ownershipType, roomType, status, inStock, search, skip, take } = params;

    const where: any = { isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (vendorId) where.vendorId = vendorId;
    if (ownershipType) where.ownershipType = ownershipType;
    if (roomType) where.roomType = { contains: roomType, mode: "insensitive" };
    if (status) where.status = status;
    if (inStock !== undefined) where.inStock = inStock;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { brandName: { contains: search, mode: "insensitive" } },
        { material: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.homeDecorProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
        },
      }),
      prisma.homeDecorProduct.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, organizationId: string, data: any) {
    return prisma.homeDecorProduct.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
      },
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.homeDecorProduct.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const homeDecorRepo = new HomeDecorRepository();
