import { materialRepo } from "../repos/material.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { vendorRepo } from "../repos/vendor.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";

export class MaterialService {
  async createProduct(organizationId: string, data: any, file?: Express.Multer.File) {
    // Validate Category
    const category = await categoryRepo.findById(data.categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }
    if (category.marketplaceType !== "MATERIALS" && category.marketplaceType !== "OTHER") {
      throw new ErrorResponse("Category must belong to the MATERIALS or OTHER vertical", statusCode.Bad_Request);
    }

    // Check SKU Uniqueness per organization
    const existingSku = await materialRepo.findBySku(data.sku, organizationId);
    if (existingSku) {
      throw new ErrorResponse(`A material product with SKU '${data.sku}' already exists in your organization`, statusCode.Conflict);
    }

    // Validate Vendor link if VENDOR_OWNED or vendorId passed
    if (data.vendorId) {
      const vendor = await vendorRepo.findById(data.vendorId, organizationId);
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in your organization", statusCode.Not_Found);
      }
      data.ownershipType = "VENDOR_OWNED";
      if (data.ownerCommissionRate === undefined && vendor.defaultCommissionRate) {
        data.ownerCommissionRate = Number(vendor.defaultCommissionRate);
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

    return materialRepo.create({
      ...data,
      organizationId,
    });
  }

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

  async getProductById(id: string, organizationId?: string) {
    const product = await materialRepo.findById(id, organizationId);
    if (!product) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }
    return product;
  }

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

    if (data.vendorId) {
      const vendor = await vendorRepo.findById(data.vendorId, organizationId);
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in your organization", statusCode.Not_Found);
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

  async deleteProduct(id: string, organizationId: string) {
    const existing = await materialRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Material product not found", statusCode.Not_Found);
    }

    return materialRepo.softDelete(id, organizationId);
  }
}

export const materialService = new MaterialService();

