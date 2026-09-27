import { prisma } from "../../../lib/prisma.js";
import {
  ProductType,
  ProductStatus,
  ProductOwnershipType,
} from "../../../types/types.js";

/**
 * ProductRepository
 * Handles data access and transactional persistence for unified marketplace products
 * and their 1-to-1 type extension entities.
 */
export class ProductRepository {
  /**
   * Create a new base Product and its nested 1-to-1 extension record in a single transaction
   */
  async create(data: {
    organizationId: string;
    name: string;
    slug: string;
    sku?: string | null;
    type: ProductType;
    description?: string | null;
    tags?: string[];
    coverImageUrl?: any;
    images?: any;
    ownershipType?: ProductOwnershipType;
    vendorId?: string | null;
    currency?: string;
    mrp?: number;
    sellingPrice?: number;
    costPrice?: number | null;
    taxRate?: number;
    isTaxInclusive?: boolean;
    discountPercent?: number;
    unit?: string | null;
    inStock?: boolean;
    stockQuantity?: number;
    minOrderQuantity?: number;
    lowStockAlert?: number;
    status?: ProductStatus;
    isFeatured?: boolean;
    isPublished?: boolean;
    additionalInformation?: any;
    createdById?: string | null;

    // Type Details
    digitalDetails?: any;
    homeDecorDetails?: any;
    propertyDetails?: any;
    materialDetails?: any;
  }) {
    const {
      digitalDetails,
      homeDecorDetails,
      propertyDetails,
      materialDetails,
      ...baseProductData
    } = data;

    return prisma.product.create({
      data: {
        ...baseProductData,
        ...(digitalDetails ? { digitalDetails: { create: digitalDetails } } : {}),
        ...(homeDecorDetails ? { homeDecorDetails: { create: homeDecorDetails } } : {}),
        ...(propertyDetails ? { propertyDetails: { create: propertyDetails } } : {}),
        ...(materialDetails ? { materialDetails: { create: materialDetails } } : {}),
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            category: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Find product by ID scoped strictly by tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { id, organizationId, isDeleted: false },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            category: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Find product by Slug scoped strictly by tenant organization
   */
  async findBySlug(slug: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { slug, organizationId, isDeleted: false },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            category: true,
            email: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Find product by SKU scoped strictly by tenant organization
   */
  async findBySku(sku: string, organizationId: string) {
    return prisma.product.findFirst({
      where: { sku, organizationId, isDeleted: false },
    });
  }

  /**
   * List paginated products with flexible filtering and sorting
   */
  async findMany(params: {
    organizationId: string;
    search?: string;
    type?: ProductType;
    status?: ProductStatus;
    ownershipType?: ProductOwnershipType;
    vendorId?: string;
    isFeatured?: boolean;
    isPublished?: boolean;
    minPrice?: number;
    maxPrice?: number;
    city?: string;
    skip: number;
    take: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const {
      organizationId,
      search,
      type,
      status,
      ownershipType,
      vendorId,
      isFeatured,
      isPublished,
      minPrice,
      maxPrice,
      city,
      skip,
      take,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    const where: any = {
      organizationId,
      isDeleted: false,
    };

    if (type) where.type = type;
    if (status) where.status = status;
    if (ownershipType) where.ownershipType = ownershipType;
    if (vendorId) where.vendorId = vendorId;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isPublished !== undefined) where.isPublished = isPublished;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = minPrice;
      if (maxPrice !== undefined) where.sellingPrice.lte = maxPrice;
    }

    if (city) {
      where.propertyDetails = {
        city: { contains: city, mode: "insensitive" },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
        {
          vendor: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    return prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            category: true,
          },
        },
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Count products for paginated queries
   */
  async count(params: {
    organizationId: string;
    search?: string;
    type?: ProductType;
    status?: ProductStatus;
    ownershipType?: ProductOwnershipType;
    vendorId?: string;
    isFeatured?: boolean;
    isPublished?: boolean;
    minPrice?: number;
    maxPrice?: number;
    city?: string;
  }) {
    const {
      organizationId,
      search,
      type,
      status,
      ownershipType,
      vendorId,
      isFeatured,
      isPublished,
      minPrice,
      maxPrice,
      city,
    } = params;

    const where: any = {
      organizationId,
      isDeleted: false,
    };

    if (type) where.type = type;
    if (status) where.status = status;
    if (ownershipType) where.ownershipType = ownershipType;
    if (vendorId) where.vendorId = vendorId;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (isPublished !== undefined) where.isPublished = isPublished;

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = minPrice;
      if (maxPrice !== undefined) where.sellingPrice.lte = maxPrice;
    }

    if (city) {
      where.propertyDetails = {
        city: { contains: city, mode: "insensitive" },
      };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { has: search } },
        {
          vendor: {
            name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    return prisma.product.count({ where });
  }

  /**
   * Update base Product and upsert/update its 1-to-1 extension records (partial updates)
   */
  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      slug?: string;
      sku?: string | null;
      description?: string | null;
      tags?: string[];
      coverImageUrl?: any;
      images?: any;
      ownershipType?: ProductOwnershipType;
      vendorId?: string | null;
      currency?: string;
      mrp?: number;
      sellingPrice?: number;
      costPrice?: number | null;
      taxRate?: number;
      isTaxInclusive?: boolean;
      discountPercent?: number;
      unit?: string | null;
      inStock?: boolean;
      stockQuantity?: number;
      minOrderQuantity?: number;
      lowStockAlert?: number;
      status?: ProductStatus;
      isFeatured?: boolean;
      isPublished?: boolean;
      additionalInformation?: any;

      // Type details
      digitalDetails?: any;
      homeDecorDetails?: any;
      propertyDetails?: any;
      materialDetails?: any;
    }
  ) {
    const {
      digitalDetails,
      homeDecorDetails,
      propertyDetails,
      materialDetails,
      ...baseUpdateData
    } = data;

    return prisma.product.update({
      where: { id },
      data: {
        ...baseUpdateData,
        ...(digitalDetails
          ? {
              digitalDetails: {
                upsert: {
                  create: digitalDetails,
                  update: digitalDetails,
                },
              },
            }
          : {}),
        ...(homeDecorDetails
          ? {
              homeDecorDetails: {
                upsert: {
                  create: homeDecorDetails,
                  update: homeDecorDetails,
                },
              },
            }
          : {}),
        ...(propertyDetails
          ? {
              propertyDetails: {
                upsert: {
                  create: propertyDetails,
                  update: propertyDetails,
                },
              },
            }
          : {}),
        ...(materialDetails
          ? {
              materialDetails: {
                upsert: {
                  create: materialDetails,
                  update: materialDetails,
                },
              },
            }
          : {}),
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            category: true,
          },
        },
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Update product status (e.g. DRAFT, PUBLISHED, ARCHIVED)
   */
  async updateStatus(id: string, status: ProductStatus) {
    return prisma.product.update({
      where: { id },
      data: {
        status,
        ...(status === ProductStatus.PUBLISHED ? { isPublished: true } : {}),
      },
      include: {
        digitalDetails: true,
        homeDecorDetails: true,
        propertyDetails: true,
        materialDetails: true,
      },
    });
  }

  /**
   * Soft delete product
   */
  async softDelete(id: string) {
    return prisma.product.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: ProductStatus.ARCHIVED,
        isPublished: false,
      },
    });
  }
}
