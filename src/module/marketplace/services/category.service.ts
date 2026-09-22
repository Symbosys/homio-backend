import { categoryRepo } from "../repos/category.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type MarketplaceType, type ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class CategoryService {
  async createCategory(
    data: {
      name: string;
      code: string;
      slug?: string;
      marketplaceType: MarketplaceType;
      description?: string | null;
      icon?: string | null;
      imageUrl?: any;
      sortOrder?: number;
      parentId?: string | null;
      isActive?: boolean;
      commissionRate?: number;
    },
    file?: Express.Multer.File
  ) {
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/marketplace/categories",
          resourceType: "image",
        }
      );

      const imageData: ImageType = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };

      data.imageUrl = imageData;
    } else if (typeof data.imageUrl === "string" && data.imageUrl.trim() !== "") {
      data.imageUrl = {
        id: "external",
        url: data.imageUrl.trim(),
        bytes: 0,
        format: "url",
        provider: "LOCAL" as const,
      };
    }

    const slug = data.slug ? slugify(data.slug) : slugify(data.name);

    // Check code uniqueness
    const existingCode = await categoryRepo.findByCode(data.code);
    if (existingCode) {
      throw new ErrorResponse(`Category with code '${data.code}' already exists`, statusCode.Conflict);
    }

    // Check slug uniqueness within marketplaceType
    const existingSlug = await categoryRepo.findBySlug(slug, data.marketplaceType);
    if (existingSlug) {
      throw new ErrorResponse(
        `Category with slug '${slug}' already exists for vertical ${data.marketplaceType}`,
        statusCode.Conflict
      );
    }

    // Verify parentId if passed
    if (data.parentId) {
      const parent = await categoryRepo.findById(data.parentId);
      if (!parent) {
        throw new ErrorResponse("Parent category not found", statusCode.Not_Found);
      }
      if (parent.marketplaceType !== data.marketplaceType) {
        throw new ErrorResponse("Parent category must belong to the same marketplace vertical", statusCode.Bad_Request);
      }
    }

    return categoryRepo.create({
      ...data,
      slug,
    });
  }

  async getCategories(params: {
    marketplaceType?: MarketplaceType;
    parentId?: string | null;
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await categoryRepo.findMany({
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

  async getCategoryTree(marketplaceType?: MarketplaceType) {
    return categoryRepo.getTree(marketplaceType);
  }

  async getCategoryById(idOrSlug: string) {
    let category = await categoryRepo.findById(idOrSlug);
    if (!category) {
      // Try by slug if UUID lookup returns null
      category = await categoryRepo.findBySlug(idOrSlug, "DIGITAL_ASSET") ||
                 await categoryRepo.findBySlug(idOrSlug, "HOME_DECOR") ||
                 await categoryRepo.findBySlug(idOrSlug, "PROPERTIES") ||
                 await categoryRepo.findBySlug(idOrSlug, "MATERIALS") ||
                 await categoryRepo.findBySlug(idOrSlug, "OTHER");
    }

    if (!category) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    return category;
  }

  async updateCategory(id: string, data: any, file?: Express.Multer.File) {
    const existing = await categoryRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/marketplace/categories",
          resourceType: "image",
        }
      );

      const imageData: ImageType = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };

      data.imageUrl = imageData;
    } else if (typeof data.imageUrl === "string" && data.imageUrl.trim() !== "") {
      data.imageUrl = {
        id: "external",
        url: data.imageUrl.trim(),
        bytes: 0,
        format: "url",
        provider: "LOCAL" as const,
      };
    }

    if (data.code && data.code !== existing.code) {
      const existingCode = await categoryRepo.findByCode(data.code);
      if (existingCode) {
        throw new ErrorResponse(`Category with code '${data.code}' already exists`, statusCode.Conflict);
      }
    }

    if (data.slug || data.name) {
      const newSlug = data.slug ? slugify(data.slug) : slugify(data.name || existing.name);
      const vertical = data.marketplaceType || existing.marketplaceType;
      const existingSlug = await categoryRepo.findBySlug(newSlug, vertical);
      if (existingSlug && existingSlug.id !== id) {
        throw new ErrorResponse(`Category with slug '${newSlug}' already exists for vertical ${vertical}`, statusCode.Conflict);
      }
      data.slug = newSlug;
    }

    return categoryRepo.update(id, data);
  }

  async deleteCategory(id: string) {
    const existing = await categoryRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
    }

    return categoryRepo.softDelete(id);
  }
}

export const categoryService = new CategoryService();
