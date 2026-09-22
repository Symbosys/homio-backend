import { prisma } from "../../../lib/prisma.js";
import type { ProductStatus, ProductOwnershipType, MaterialUnit, Prisma } from "../../../types/types.js";

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
 * Repository handling database operations for Wholesale Material products and their multi-vendor offerings
 */
export class MaterialRepository {
  /**
   * Create a master Material product
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

    return prisma.materialProduct.findFirst({
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
    return prisma.materialProduct.findFirst({
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
    if (vendorId) {
      where.vendorOfferings = {
        some: {
          vendorId,
          isActive: true,
        },
      };
    }
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
          ...vendorOfferingInclude,
        },
      }),
      prisma.materialProduct.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update master material product
   */
  async update(id: string, organizationId: string, data: any) {
    return prisma.materialProduct.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        ...vendorOfferingInclude,
      },
    });
  }

  /**
   * Soft delete material product
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.materialProduct.update({
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
   * Create a vendor offering / supply mapping for a Material product
   */
  async createVendorOffering(data: {
    organizationId: string;
    productId: string;
    vendorId: string;
    commissionRate: number | string | Prisma.Decimal;
    wholesalePrice?: number | null;
    retailPrice?: number | null;
    vendorSku?: string | null;
    stockAvailableUnits?: number;
    minOrderQuantity?: number;
    leadTimeDays?: number;
    isPrimary?: boolean;
    additionalInformation?: any;
  }) {
    return prisma.materialProductVendor.create({
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
   * Fetch all vendor offerings for a material product
   */
  async findVendorOfferings(productId: string, organizationId: string) {
    return prisma.materialProductVendor.findMany({
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

    return prisma.materialProductVendor.findFirst({
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
    return prisma.materialProductVendor.findFirst({
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
    return prisma.materialProductVendor.update({
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
      await tx.materialProductVendor.updateMany({
        where: { productId, organizationId },
        data: { isPrimary: false },
      });

      // Set primary on target offering
      return tx.materialProductVendor.update({
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
    return prisma.materialProductVendor.delete({
      where: { id },
    });
  }
}

export const materialRepo = new MaterialRepository();
