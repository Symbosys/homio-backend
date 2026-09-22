import { propertyRepo } from "../repos/property.repo.js";
import { categoryRepo } from "../repos/category.repo.js";
import { sellerCategoryService } from "./seller-category.service.js";
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

export class PropertyService {
  async createProperty(organizationId: string, data: any, file?: Express.Multer.File) {
    if (data.categoryId) {
      const category = await categoryRepo.findById(data.categoryId);
      if (!category) {
        throw new ErrorResponse("Marketplace category not found", statusCode.Not_Found);
      }
      if (category.marketplaceType !== "PROPERTIES") {
        throw new ErrorResponse("Category must belong to the PROPERTIES vertical", statusCode.Bad_Request);
      }

      // Automatically ensure organization category registration and inherit commission rate
      await sellerCategoryService.ensureOrganizationCategoryCommission(organizationId, category.id);
    }

    const slug = data.slug ? slugify(data.slug) : slugify(`${data.title}-${data.city}-${Date.now().toString().slice(-4)}`);
    const existingSlug = await propertyRepo.findBySlug(slug, organizationId);
    if (existingSlug) {
      throw new ErrorResponse(`A property listing with slug '${slug}' already exists in your organization`, statusCode.Conflict);
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
          folder: "homio/marketplace/properties",
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

    return propertyRepo.create({
      ...data,
      organizationId,
      slug,
    });
  }

  async getProperties(params: {
    organizationId?: string;
    categoryId?: string;
    city?: string;
    locality?: string;
    propertyType?: any;
    intent?: any;
    bhk?: string;
    minPrice?: number;
    maxPrice?: number;
    verificationStatus?: any;
    status?: any;
    search?: string;
    page: number;
    limit: number;
  }, isOwnerOrAdmin = false) {
    const { page, limit, ...filters } = params;
    const skip = (page - 1) * limit;

    const { items, total } = await propertyRepo.findMany({
      ...filters,
      skip,
      take: limit,
    });

    // Mask sensitive owner contacts for general discovery unless admin/owner
    const sanitizedItems = items.map((prop) => {
      if (isOwnerOrAdmin) return prop;
      return {
        ...prop,
        ownerPhone: `${prop.ownerPhone.slice(0, 3)}XXXXXX${prop.ownerPhone.slice(-2)}`,
        ownerEmail: prop.ownerEmail ? `****@${prop.ownerEmail.split("@")[1] || "gmail.com"}` : null,
      };
    });

    return {
      items: sanitizedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPropertyById(id: string, organizationId?: string, isOwnerOrAdmin = false) {
    const property = await propertyRepo.findById(id, organizationId);
    if (!property) {
      throw new ErrorResponse("Property listing not found", statusCode.Not_Found);
    }

    if (!isOwnerOrAdmin) {
      return {
        ...property,
        ownerPhone: `${property.ownerPhone.slice(0, 3)}XXXXXX${property.ownerPhone.slice(-2)}`,
        ownerEmail: property.ownerEmail ? `****@${property.ownerEmail.split("@")[1] || "gmail.com"}` : null,
      };
    }

    return property;
  }

  async updateProperty(id: string, organizationId: string, data: any, file?: Express.Multer.File) {
    const existing = await propertyRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Property listing not found", statusCode.Not_Found);
    }

    if (data.slug || (data.title && data.title !== existing.title)) {
      const newSlug = data.slug ? slugify(data.slug) : slugify(data.title || existing.title);
      const duplicateSlug = await propertyRepo.findBySlug(newSlug, organizationId);
      if (duplicateSlug && duplicateSlug.id !== id) {
        throw new ErrorResponse(`A property listing with slug '${newSlug}' already exists in your organization`, statusCode.Conflict);
      }
      data.slug = newSlug;
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
          folder: "homio/marketplace/properties",
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

    return propertyRepo.update(id, organizationId, data);
  }

  async updateVerificationStatus(id: string, verificationStatus: any) {
    const existing = await propertyRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Property listing not found", statusCode.Not_Found);
    }

    return propertyRepo.updateVerification(id, verificationStatus);
  }

  async deleteProperty(id: string, organizationId: string) {
    const existing = await propertyRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Property listing not found", statusCode.Not_Found);
    }

    return propertyRepo.softDelete(id, organizationId);
  }
}

export const propertyService = new PropertyService();

