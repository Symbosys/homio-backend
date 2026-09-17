import { prisma } from "../../../lib/prisma.js";
import type { ProductStatus, DigitalFileFormat } from "../../../types/types.js";

export class DigitalProductRepository {
  async create(data: {
    organizationId: string;
    categoryId: string;
    name: string;
    sku: string;
    urlSlug: string;
    description?: string | null;
    tags?: string[];
    authorName?: string | null;
    fileUrl: string;
    fileFormat?: DigitalFileFormat;
    fileSize?: string | null;
    coverImageUrl?: any;
    previewImages?: any;
    downloadLinkExpiryHours?: number;
    maxDownloads?: number;
    mrp?: number;
    sellingPrice?: number;
    taxRate?: number;
    status?: ProductStatus;
    isFeatured?: boolean;
  }) {
    return prisma.digitalProduct.create({
      data: data as any,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findById(id: string, organizationId?: string) {
    const where: any = { id, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;

    return prisma.digitalProduct.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findBySku(sku: string, organizationId: string) {
    return prisma.digitalProduct.findFirst({
      where: { sku, organizationId, isDeleted: false },
    });
  }

  async findBySlug(urlSlug: string, organizationId: string) {
    return prisma.digitalProduct.findFirst({
      where: { urlSlug, organizationId, isDeleted: false },
    });
  }

  async findMany(params: {
    organizationId?: string;
    categoryId?: string;
    status?: ProductStatus;
    isFeatured?: boolean;
    search?: string;
    skip: number;
    take: number;
  }) {
    const { organizationId, categoryId, status, isFeatured, search, skip, take } = params;

    const where: any = { isDeleted: false };
    if (organizationId) where.organizationId = organizationId;
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { authorName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.digitalProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.digitalProduct.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, organizationId: string, data: any) {
    return prisma.digitalProduct.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.digitalProduct.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const digitalProductRepo = new DigitalProductRepository();
