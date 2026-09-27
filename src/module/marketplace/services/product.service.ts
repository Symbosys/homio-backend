import { ProductRepository } from "../repos/product.repo.js";
import { VendorRepository } from "../repos/vendor.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import {
  statusCode,
  ProductType,
  ProductStatus,
  ProductOwnershipType,
} from "../../../types/types.js";

export const productRepo = new ProductRepository();
export const vendorRepo = new VendorRepository();

/**
 * Helper to slugify a string for clean, SEO-friendly URLs
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

export class ProductService {
  /**
   * Create a new marketplace product with optional type-specific 1:1 details
   */
  async createProduct(
    organizationId: string,
    data: {
      name: string;
      slug?: string;
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
      digitalDetails?: any;
      homeDecorDetails?: any;
      propertyDetails?: any;
      materialDetails?: any;
    },
    createdById?: string | null,
  ) {
    // 1. Slug Resolution & Uniqueness
    let baseSlug = data.slug ? slugify(data.slug) : slugify(data.name);
    if (!baseSlug) {
      baseSlug = `product-${Date.now()}`;
    }

    let resolvedSlug = baseSlug;
    let count = 1;
    while (await productRepo.findBySlug(resolvedSlug, organizationId)) {
      resolvedSlug = `${baseSlug}-${count}`;
      count++;
    }

    // 2. SKU Uniqueness check within organization
    if (data.sku) {
      const existingSku = await productRepo.findBySku(data.sku, organizationId);
      if (existingSku) {
        throw new ErrorResponse(
          `Product with SKU '${data.sku}' already exists in your organization`,
          statusCode.Conflict,
        );
      }
    }

    // 3. Vendor Validation if vendor-owned or vendorId provided
    if (data.vendorId) {
      const vendor = await vendorRepo.findById(data.vendorId, organizationId);
      if (!vendor) {
        throw new ErrorResponse(
          "Specified Vendor not found in your organization",
          statusCode.Not_Found,
        );
      }
    }

    // 4. Calculate discount percent if MRP and sellingPrice provided
    let discountPercent = data.discountPercent ?? 0;
    if (
      data.mrp &&
      data.sellingPrice &&
      data.mrp > data.sellingPrice &&
      !data.discountPercent
    ) {
      discountPercent = Number(
        (((data.mrp - data.sellingPrice) / data.mrp) * 100).toFixed(2),
      );
    }

    return productRepo.create({
      ...data,
      organizationId,
      slug: resolvedSlug,
      discountPercent,
      createdById,
    });
  }

  /**
   * Get paginated products catalog with filters
   */
  async getProducts(
    organizationId: string,
    params: {
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
      page: number;
      limit: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    },
  ) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      productRepo.findMany({
        organizationId,
        ...filters,
        skip,
        take: limit,
      }),
      productRepo.count({
        organizationId,
        ...filters,
      }),
    ]);

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
   * Get single product by ID
   */
  async getProductById(id: string, organizationId: string) {
    const product = await productRepo.findById(id, organizationId);
    if (!product) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }
    return product;
  }

  /**
   * Get single product by Slug
   */
  async getProductBySlug(slug: string, organizationId: string) {
    const product = await productRepo.findBySlug(slug, organizationId);
    if (!product) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }
    return product;
  }

  /**
   * Update product (partial / dirty updates)
   */
  async updateProduct(
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
      digitalDetails?: any;
      homeDecorDetails?: any;
      propertyDetails?: any;
      materialDetails?: any;
    },
  ) {
    const existing = await productRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    // Check SKU conflict if updated
    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await productRepo.findBySku(
        data.sku,
        organizationId,
      );
      if (duplicateSku && duplicateSku.id !== id) {
        throw new ErrorResponse(
          `Product with SKU '${data.sku}' already exists in your organization`,
          statusCode.Conflict,
        );
      }
    }

    // Check Slug conflict if updated
    let updatedSlug = data.slug ? slugify(data.slug) : undefined;
    if (updatedSlug && updatedSlug !== existing.slug) {
      const duplicateSlug = await productRepo.findBySlug(
        updatedSlug,
        organizationId,
      );
      if (duplicateSlug && duplicateSlug.id !== id) {
        throw new ErrorResponse(
          `Product with Slug '${updatedSlug}' already exists in your organization`,
          statusCode.Conflict,
        );
      }
    }

    // Check Vendor if updated
    if (data.vendorId && data.vendorId !== existing.vendorId) {
      const vendor = await vendorRepo.findById(data.vendorId, organizationId);
      if (!vendor) {
        throw new ErrorResponse(
          "Specified Vendor not found in your organization",
          statusCode.Not_Found,
        );
      }
    }

    // Calculate discount if prices changed
    let discountPercent = data.discountPercent;
    const finalMrp = data.mrp !== undefined ? data.mrp : Number(existing.mrp);
    const finalSellingPrice =
      data.sellingPrice !== undefined
        ? data.sellingPrice
        : Number(existing.sellingPrice);
    if (
      finalMrp > 0 &&
      finalMrp > finalSellingPrice &&
      discountPercent === undefined
    ) {
      discountPercent = Number(
        (((finalMrp - finalSellingPrice) / finalMrp) * 100).toFixed(2),
      );
    }

    return productRepo.update(id, organizationId, {
      ...data,
      ...(updatedSlug ? { slug: updatedSlug } : {}),
      ...(discountPercent !== undefined ? { discountPercent } : {}),
    });
  }

  /**
   * Update product publishing status
   */
  async updateProductStatus(
    id: string,
    organizationId: string,
    status: ProductStatus,
  ) {
    const existing = await productRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    return productRepo.updateStatus(id, status);
  }

  /**
   * Soft delete product
   */
  async deleteProduct(id: string, organizationId: string) {
    const existing = await productRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Product not found", statusCode.Not_Found);
    }

    return productRepo.softDelete(id);
  }
}

export const productService = new ProductService();
