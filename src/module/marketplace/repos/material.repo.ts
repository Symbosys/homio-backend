import { prisma } from "../../../lib/prisma.js";
import type { ProductStatus, ProductOwnershipType, MaterialUnit } from "../../../types/types.js";

export class MaterialRepository {
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
    materialType?: string | null;
    grade?: string | null;
    dimensions?: string | null;
    thickness?: string | null;
    application?: string | null;
    coverImageUrl?: any;
    images?: any;
    unitOfMeasure?: MaterialUnit;
    wholesalePrice?: number;
    retailPrice?: number;
    taxRate?: number;
    minOrderQuantity?: number;
    stockAvailableUnits?: number;
    status?: ProductStatus;
    isFeatured?: boolean;
  }) {
    return prisma.materialProduct.create({
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

    return prisma.materialProduct.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findBySku(sku: string, organizationId: string) {
    return prisma.materialProduct.findFirst({
      where: { sku, organizationId, isDeleted: false },
    });
  }

  async findMany(params: {
    organizationId?: string;
    categoryId?: string;
    vendorId?: string;
    ownershipType?: ProductOwnershipType;
    unitOfMeasure?: MaterialUnit;
    materialType?: string;
    status?: ProductStatus;
    search?: string;
    skip: number;
    take: number;
  }) {
    const {
      organizationId,
      categoryId,
      vendorId,
      ownershipType,
      unitOfMeasure,
      materialType,
      status,
      search,
      skip,
      take,
    } = params;

    const where: any = { isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (vendorId) where.vendorId = vendorId;
    if (ownershipType) where.ownershipType = ownershipType;
    if (unitOfMeasure) where.unitOfMeasure = unitOfMeasure;
    if (materialType) where.materialType = { contains: materialType, mode: "insensitive" };
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { brandName: { contains: search, mode: "insensitive" } },
        { materialType: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.materialProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
        },
      }),
      prisma.materialProduct.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, organizationId: string, data: any) {
    return prisma.materialProduct.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        vendor: { select: { id: true, name: true, code: true, defaultCommissionRate: true } },
      },
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.materialProduct.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const materialRepo = new MaterialRepository();
