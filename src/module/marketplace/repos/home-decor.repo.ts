import { prisma } from "../../../lib/prisma.js";
import type { ProductStatus, ProductOwnershipType, AffiliatePartner, Prisma } from "../../../types/types.js";

const vendorOfferingInclude = {
  vendorOfferings: {
    where: { isActive: true },
    orderBy: [{ isPrimary: "desc" as const }, { createdAt: "asc" as const }],
    include: {
      vendor: {
        select: {
          id: true,
          name: true,
          code: true,
          defaultCommissionRate: true,
          phone: true,
          email: true,
        },
      },
    },
  },
};

/**
 * Repository handling database operations for Home Decor products and their multi-vendor offerings
 */
export class HomeDecorRepository {
  /**
   * Create a master Home Decor product
   */
  async create(data: {
    organizationId: string;
    categoryId: string;
    ownershipType?: ProductOwnershipType;
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
        ...vendorOfferingInclude,
      },
    });
  }

  /**
   * Find single product by ID with category and vendor offerings
   */
  async findById(id: string, organizationId?: string) {
    const where: any = { id, isDeleted: false };
    if (organizationId) where.organizationId = organizationId;

    return prisma.homeDecorProduct.findFirst({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        organization: { select: { id: true, name: true, slug: true } },
        ...vendorOfferingInclude,
      },
    });
  }

  /**
   * Find product by SKU within an organization
   */
  async findBySku(sku: string, organizationId: string) {
    return prisma.homeDecorProduct.findFirst({
      where: { sku, organizationId, isDeleted: false },
    });
  }

  /**
   * Find paginated list of products with filters
   */
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
    if (vendorId) {
      where.vendorOfferings = {
        some: {
          vendorId,
          isActive: true,
        },
      };
    }
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
          ...vendorOfferingInclude,
        },
      }),
      prisma.homeDecorProduct.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update master product attributes
   */
  async update(id: string, organizationId: string, data: any) {
    return prisma.homeDecorProduct.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        ...vendorOfferingInclude,
      },
    });
  }

  /**
   * Soft delete master product
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.homeDecorProduct.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // ===========================================================================
  // MULTI-VENDOR OFFERINGS METHODS
  // ===========================================================================

  /**
   * Create a vendor offering / supplier mapping for a Home Decor product
   */
  async createVendorOffering(data: {
    organizationId: string;
    productId: string;
    vendorId: string;
    commissionRate: number | string | Prisma.Decimal;
    supplyPrice?: number | null;
    sellingPrice?: number | null;
    vendorSku?: string | null;
    stockCount?: number;
    inStock?: boolean;
    minOrderQuantity?: number;
    leadTimeDays?: number;
    isPrimary?: boolean;
    additionalInformation?: any;
  }) {
    return prisma.homeDecorProductVendor.create({
      data: data as any,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCommissionRate: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Fetch all vendor offerings for a product
   */
  async findVendorOfferings(productId: string, organizationId: string) {
    return prisma.homeDecorProductVendor.findMany({
      where: {
        productId,
        organizationId,
        isActive: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCommissionRate: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find single vendor offering by ID
   */
  async findVendorOfferingById(id: string, organizationId?: string) {
    const where: any = { id };
    if (organizationId) where.organizationId = organizationId;

    return prisma.homeDecorProductVendor.findFirst({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCommissionRate: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find offering by Product ID and Vendor ID
   */
  async findVendorOfferingByProductAndVendor(productId: string, vendorId: string, organizationId: string) {
    return prisma.homeDecorProductVendor.findFirst({
      where: {
        productId,
        vendorId,
        organizationId,
      },
    });
  }

  /**
   * Update a vendor offering
   */
  async updateVendorOffering(id: string, organizationId: string, data: any) {
    return prisma.homeDecorProductVendor.update({
      where: { id },
      data,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            defaultCommissionRate: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Set an offering as the primary supplier for a product (atomically unsetting others)
   */
  async setPrimaryVendorOffering(productId: string, vendorOfferingId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      // Unset primary for all offerings of this product
      await tx.homeDecorProductVendor.updateMany({
        where: { productId, organizationId },
        data: { isPrimary: false },
      });

      // Set primary on target offering
      return tx.homeDecorProductVendor.update({
        where: { id: vendorOfferingId },
        data: { isPrimary: true, isActive: true },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              code: true,
              defaultCommissionRate: true,
              phone: true,
              email: true,
            },
          },
        },
      });
    });
  }

  /**
   * Delete a vendor offering
   */
  async deleteVendorOffering(id: string, organizationId: string) {
    return prisma.homeDecorProductVendor.delete({
      where: { id },
    });
  }
}

export const homeDecorRepo = new HomeDecorRepository();
