import { digitalProductRepo } from "../repos/digital-product.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class DigitalProductService {
  async createProduct(organizationId: string, data: any, file?: Express.Multer.File) {
    // Validate Category
    const category = await categoryRepo.findById(data.categoryId);
    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }
    if (category.marketplaceType !== "DIGITAL_ASSET") {
      throw new ErrorResponse("Category must belong to the DIGITAL_ASSET vertical", statusCode.Bad_Request);
    }

    // Check SKU Uniqueness per organization
    const existingSku = await digitalProductRepo.findBySku(data.sku, organizationId);
    if (existingSku) {
      throw new ErrorResponse(`A digital product with SKU '${data.sku}' already exists in your organization`, statusCode.Conflict);
    }

    // Slug generation and uniqueness
    const urlSlug = data.urlSlug ? slugify(data.urlSlug) : slugify(data.name);
    const existingSlug = await digitalProductRepo.findBySlug(urlSlug, organizationId);
    if (existingSlug) {
      throw new ErrorResponse(`A digital product with URL slug '${urlSlug}' already exists in your organization`, statusCode.Conflict);
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
          folder: "homio/marketplace/digital-products",
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

    return digitalProductRepo.create({
      ...data,
      organizationId,
      urlSlug,
    });
  }

  async getProducts(params: {
    organizationId?: string;
    categoryId?: string;
    status?: any;
    isFeatured?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await digitalProductRepo.findMany({
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
    const product = await digitalProductRepo.findById(id, organizationId);
    if (!product) {
      throw new ErrorResponse("Digital product not found", statusCode.Not_Found);
    }
    return product;
  }

  async updateProduct(id: string, organizationId: string, data: any, file?: Express.Multer.File) {
    const existing = await digitalProductRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Digital product not found", statusCode.Not_Found);
    }

    if (data.sku && data.sku !== existing.sku) {
      const duplicateSku = await digitalProductRepo.findBySku(data.sku, organizationId);
      if (duplicateSku) {
        throw new ErrorResponse(`A digital product with SKU '${data.sku}' already exists in your organization`, statusCode.Conflict);
      }
    }

    if (data.urlSlug || (data.name && data.name !== existing.name)) {
      const newSlug = data.urlSlug ? slugify(data.urlSlug) : slugify(data.name || existing.name);
      const duplicateSlug = await digitalProductRepo.findBySlug(newSlug, organizationId);
      if (duplicateSlug && duplicateSlug.id !== id) {
        throw new ErrorResponse(`A digital product with URL slug '${newSlug}' already exists in your organization`, statusCode.Conflict);
      }
      data.urlSlug = newSlug;
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
          folder: "homio/marketplace/digital-products",
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

    return digitalProductRepo.update(id, organizationId, data);
  }

  async deleteProduct(id: string, organizationId: string) {
    const existing = await digitalProductRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Digital product not found", statusCode.Not_Found);
    }

    return digitalProductRepo.softDelete(id, organizationId);
  }
}

export const digitalProductService = new DigitalProductService();

