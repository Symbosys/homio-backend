import { materialRepo } from "../repos/material.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { vendorRepo } from "../repos/vendor.repo.js";
import { sellerCategoryService } from "./seller-category.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";

/**
 * Service managing catalog operations, multi-vendor sourcing, and commission rates for Material products
 */
export class MaterialService {
  /**
   * Create a new Material product, optionally attaching initial vendor offerings
   */
  async createProduct(organizationId: string, data: any, file?: Express.Multer.File) {
    const { vendorOfferings, ...productData } = data;

    // Validate Category
    const category = await categoryRepo.findById(productData.categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }
    if (category.marketplaceType !== "MATERIALS" && category.marketplaceType !== "OTHER") {
      throw new ErrorResponse("Category must belong to the MATERIALS or OTHER vertical", statusCode.Bad_Request);
    }

    // Automatically ensure organization category registration and inherit commission rate
    await sellerCategoryService.ensureOrganizationCategoryCommission(organizationId, category.id);

    // Check SKU Uniqueness per organization
    const existingSku = await materialRepo.findBySku(productData.sku, organizationId);
    if (existingSku) {
      throw new ErrorResponse(`A material product with SKU '${productData.sku}' already exists in your organization`, statusCode.Conflict);
    }

    // If initial vendor offerings provided, validate vendors and set VENDOR_OWNED
    const preparedOfferings: any[] = [];
    if (Array.isArray(vendorOfferings) && vendorOfferings.length > 0) {
      productData.ownershipType = "VENDOR_OWNED";
      for (let i = 0; i < vendorOfferings.length; i++) {
        const offering = vendorOfferings[i];
        const vendor = await vendorRepo.findById(offering.vendorId, organizationId);
        if (!vendor) {
          throw new ErrorResponse(`Vendor '${offering.vendorId}' not found in your organization`, statusCode.Not_Found);
        }

        const commissionRate =
          offering.commissionRate !== undefined && offering.commissionRate !== null
            ? offering.commissionRate
            : vendor.defaultCommissionRate !== null && vendor.defaultCommissionRate !== undefined
              ? Number(vendor.defaultCommissionRate)
              : 0;

        preparedOfferings.push({
          ...offering,
          commissionRate,
          isPrimary: offering.isPrimary ?? i === 0,
        });
      }
    }

    // Upload Cover Image if file provided
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/marketplace/materials",
          resourceType: "image",
        }
      );

      productData.coverImageUrl = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    } else if (typeof productData.coverImageUrl === "string" && productData.coverImageUrl.trim() !== "") {
      productData.coverImageUrl = {
        id: "external",
        url: productData.coverImageUrl.trim(),
        bytes: 0,
        format: "image",
        provider: "LOCAL",
      };
    }

    const createdProduct = await materialRepo.create({
      ...productData,
      organizationId,
    });

    // Create attached vendor offerings if any
    for (const offering of preparedOfferings) {
      await materialRepo.createVendorOffering({
        ...offering,
        organizationId,
        productId: createdProduct.id,
      });
    }

    return materialRepo.findById(createdProduct.id, organizationId);
  }

  /**
   * Fetch paginated list of Material products
   */
  async getProducts(params: {
    organizationId?: string;
    categoryId?: string;
    vendorId?: string;
    ownershipType?: any;
    unitOfMeasure?: any;
    materialType?: string;
    status?: any;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await materialRepo.findMany({
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
   * Retrieve single product with full vendor offering details
   */
  async getProductById(id: string, organizationId?: string) {
    const product = await materialRepo.findById(id, organizationId);
    if (!product) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }
    return product;
  }

  /**
   * Update master product attributes
   */
  async updateProduct(id: string, organizationId: string, data: any, file?: Express.Multer.File) {
    const existing = await materialRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }

    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await materialRepo.findBySku(data.sku, organizationId);
      if (duplicateSku) {
        throw new ErrorResponse(`A material product with SKU '${data.sku}' already exists in your organization`, statusCode.Conflict);
      }
    }

    // Upload Cover Image if file provided
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/marketplace/materials",
          resourceType: "image",
        }
      );

      data.coverImageUrl = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    } else if (typeof data.coverImageUrl === "string" && data.coverImageUrl.trim() !== "") {
      data.coverImageUrl = {
        id: "external",
        url: data.coverImageUrl.trim(),
        bytes: 0,
        format: "image",
        provider: "LOCAL",
      };
    }

    return materialRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete Material product
   */
  async deleteProduct(id: string, organizationId: string) {
    const existing = await materialRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }

    return materialRepo.softDelete(id, organizationId);
  }

  // ===========================================================================
  // MULTI-VENDOR OFFERING MANAGEMENT
  // ===========================================================================

  /**
   * Attach a new vendor offering / supplier to a Material product
   */
  async addVendorOffering(organizationId: string, productId: string, data: any) {
    const product = await materialRepo.findById(productId, organizationId);
    if (!product) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }

    const vendor = await vendorRepo.findById(data.vendorId, organizationId);
    if (!vendor) {
      throw new ErrorResponse("Vendor not found in your organization", statusCode.Not_Found);
    }

    const existingOffering = await materialRepo.findVendorOfferingByProductAndVendor(
      productId,
      data.vendorId,
      organizationId
    );
    if (existingOffering) {
      throw new ErrorResponse("This vendor is already attached to this product", statusCode.Conflict);
    }

    // Resolve commission rate fallback
    const commissionRate =
      data.commissionRate !== undefined && data.commissionRate !== null
        ? data.commissionRate
        : vendor.defaultCommissionRate !== null && vendor.defaultCommissionRate !== undefined
          ? Number(vendor.defaultCommissionRate)
          : 0;

    // Automatically ensure product ownership is VENDOR_OWNED
    if (product.ownershipType !== "VENDOR_OWNED") {
      await materialRepo.update(productId, organizationId, { ownershipType: "VENDOR_OWNED" });
    }

    // If isPrimary requested, set it via primary switch method
    const offering = await materialRepo.createVendorOffering({
      ...data,
      commissionRate,
      organizationId,
      productId,
    });

    if (data.isPrimary) {
      return materialRepo.setPrimaryVendorOffering(productId, offering.id, organizationId);
    }

    return offering;
  }

  /**
   * List all vendor offerings for a product
   */
  async getVendorOfferings(organizationId: string, productId: string) {
    const product = await materialRepo.findById(productId, organizationId);
    if (!product) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }

    return materialRepo.findVendorOfferings(productId, organizationId);
  }

  /**
   * Get single vendor offering by ID
   */
  async getVendorOfferingById(organizationId: string, productId: string, vendorOfferingId: string) {
    const offering = await materialRepo.findVendorOfferingById(vendorOfferingId, organizationId);
    if (!offering || offering.productId !== productId) {
      throw new ErrorResponse("Vendor offering not found for this product", statusCode.Not_Found);
    }
    return offering;
  }

  /**
   * Update a vendor offering (pricing, commission rate, stock, etc.)
   */
  async updateVendorOffering(organizationId: string, productId: string, vendorOfferingId: string, data: any) {
    const offering = await materialRepo.findVendorOfferingById(vendorOfferingId, organizationId);
    if (!offering || offering.productId !== productId) {
      throw new ErrorResponse("Vendor offering not found for this product", statusCode.Not_Found);
    }

    if (data.isPrimary) {
      await materialRepo.setPrimaryVendorOffering(productId, vendorOfferingId, organizationId);
      delete data.isPrimary;
    }

    return materialRepo.updateVendorOffering(vendorOfferingId, organizationId, data);
  }

  /**
   * Remove / Detach a vendor offering from a product
   */
  async removeVendorOffering(organizationId: string, productId: string, vendorOfferingId: string) {
    const offering = await materialRepo.findVendorOfferingById(vendorOfferingId, organizationId);
    if (!offering || offering.productId !== productId) {
      throw new ErrorResponse("Vendor offering not found for this product", statusCode.Not_Found);
    }

    return materialRepo.deleteVendorOffering(vendorOfferingId, organizationId);
  }

  /**
   * Set an offering as the primary supplier for a product
   */
  async setPrimaryVendorOffering(organizationId: string, productId: string, vendorOfferingId: string) {
    const offering = await materialRepo.findVendorOfferingById(vendorOfferingId, organizationId);
    if (!offering || offering.productId !== productId) {
      throw new ErrorResponse("Vendor offering not found for this product", statusCode.Not_Found);
    }

    return materialRepo.setPrimaryVendorOffering(productId, vendorOfferingId, organizationId);
  }
}

export const materialService = new MaterialService();

