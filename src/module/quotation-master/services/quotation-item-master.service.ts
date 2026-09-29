import { quotationItemMasterRepo } from "../repos/quotation-item-master.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import type {
  CreateQuotationItemInput,
  UpdateQuotationItemInput,
  GetQuotationItemsQueryInput,
  BulkCreateQuotationItemsInput,
} from "../validators/quotation-item-master.validator.js";

/**
 * Service: Quotation Item Master Management
 * Implements catalog business rules, SKU uniqueness checks, multi-cloud media storage, and soft delete lifecycle
 */
export class QuotationItemMasterService {
  /**
   * Create a new item master record
   */
  async createItem(organizationId: string, input: CreateQuotationItemInput) {
    const normalizedSku = input.sku.trim().toUpperCase();

    // Check SKU uniqueness within tenant
    const existing = await quotationItemMasterRepo.findBySku(
      normalizedSku,
      organizationId,
    );
    if (existing) {
      throw new ErrorResponse(
        `Item with SKU "${normalizedSku}" already exists in your organization`,
        statusCode.Conflict,
      );
    }

    return quotationItemMasterRepo.create(organizationId, {
      ...input,
      sku: normalizedSku,
      subcategory: input.subcategory || "Standard",
      description: input.description || null,
      imageUrl: input.imageUrl ? (input.imageUrl as any) : undefined,
      galleryImages: input.galleryImages ? (input.galleryImages as any) : [],
      additionalInformation: input.additionalInformation || undefined,
    });
  }

  /**
   * Bulk create / import catalog items
   */
  async bulkCreateItems(
    organizationId: string,
    input: BulkCreateQuotationItemsInput,
  ) {
    // Check for duplicate SKUs in the input array itself
    const skus = input.items.map((i) => i.sku.trim().toUpperCase());
    const uniqueSkus = new Set(skus);
    if (uniqueSkus.size !== skus.length) {
      throw new ErrorResponse(
        "Duplicate SKUs detected within the provided batch payload",
        statusCode.Bad_Request,
      );
    }

    const payload = input.items.map((item) => ({
      ...item,
      sku: item.sku.trim().toUpperCase(),
      subcategory: item.subcategory || "Standard",
      description: item.description || null,
      additionalInformation: item.additionalInformation || undefined,
    }));

    return quotationItemMasterRepo.bulkCreate(organizationId, payload as any);
  }

  /**
   * Fetch paginated list of catalog items
   */
  async getItems(organizationId: string, query: GetQuotationItemsQueryInput) {
    return quotationItemMasterRepo.findAll(organizationId, query);
  }

  /**
   * Fetch single catalog item by ID
   */
  async getItemById(id: string, organizationId: string) {
    const item = await quotationItemMasterRepo.findById(id, organizationId);
    if (!item) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }
    return item;
  }

  /**
   * Get category summary metrics
   */
  async getCategorySummary(organizationId: string) {
    return quotationItemMasterRepo.getCategorySummary(organizationId);
  }

  /**
   * Update catalog item (partial / dirty update)
   */
  async updateItem(
    id: string,
    organizationId: string,
    input: UpdateQuotationItemInput,
  ) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    // If SKU is being changed, check for conflict with other items in same tenant
    if (input.sku) {
      const normalizedSku = input.sku.trim().toUpperCase();
      if (normalizedSku !== existing.sku) {
        const skuTaken = await quotationItemMasterRepo.findBySku(
          normalizedSku,
          organizationId,
        );
        if (skuTaken && skuTaken.id !== id) {
          throw new ErrorResponse(
            `SKU "${normalizedSku}" is already in use by another item`,
            statusCode.Conflict,
          );
        }
      }
    }

    // Cloud Storage Cleanup: If primary imageUrl is being replaced/removed, delete old asset from cloud
    if (input.imageUrl !== undefined) {
      const oldImageId = (existing.imageUrl as any)?.id;
      const newImageId = (input.imageUrl as any)?.id;
      if (oldImageId && oldImageId !== newImageId) {
        try {
          await storageService.delete(oldImageId);
        } catch {
          // Continue gracefully
        }
      }
    }

    // Cloud Storage Cleanup: If galleryImages is being updated, delete any removed gallery assets from cloud
    if (
      input.galleryImages !== undefined &&
      Array.isArray(existing.galleryImages)
    ) {
      const newGalleryIds = new Set(
        Array.isArray(input.galleryImages)
          ? input.galleryImages.map((img: any) => img?.id).filter(Boolean)
          : [],
      );

      for (const oldImg of existing.galleryImages as any[]) {
        if (oldImg?.id && !newGalleryIds.has(oldImg.id)) {
          try {
            await storageService.delete(oldImg.id);
          } catch {
            // Continue gracefully
          }
        }
      }
    }

    const updatePayload: any = {
      ...input,
      sku: input.sku ? input.sku.trim().toUpperCase() : undefined,
      subcategory:
        input.subcategory !== undefined ? input.subcategory : undefined,
      description:
        input.description !== undefined ? input.description : undefined,
      imageUrl:
        input.imageUrl !== undefined ? (input.imageUrl as any) : undefined,
      galleryImages:
        input.galleryImages !== undefined
          ? (input.galleryImages as any)
          : undefined,
      additionalInformation:
        input.additionalInformation !== undefined
          ? input.additionalInformation
          : undefined,
    };

    return quotationItemMasterRepo.update(id, organizationId, updatePayload);
  }

  /**
   * Soft delete catalog item and delete all associated cloud images
   */
  async deleteItem(id: string, organizationId: string) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    // Delete primary thumbnail from cloud storage
    if (
      existing.imageUrl &&
      typeof existing.imageUrl === "object" &&
      (existing.imageUrl as any).id
    ) {
      try {
        await storageService.delete((existing.imageUrl as any).id);
      } catch {
        // Continue gracefully
      }
    }

    // Delete all gallery images from cloud storage
    if (Array.isArray(existing.galleryImages)) {
      for (const img of existing.galleryImages as any[]) {
        if (img?.id) {
          try {
            await storageService.delete(img.id);
          } catch {
            // Continue gracefully
          }
        }
      }
    }

    await quotationItemMasterRepo.softDelete(id, organizationId);
    return { message: "Quotation item master deleted successfully" };
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: string, organizationId: string) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    return quotationItemMasterRepo.toggleActive(id, existing.isActive);
  }

  /**
   * Upload primary image for item
   */
  async uploadPrimaryImage(
    id: string,
    organizationId: string,
    file: Express.Multer.File,
  ) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/quotation/items/${id}`,
        resourceType: "image",
      },
    );

    const imageObj: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };

    // If there was an old image, attempt cleanup
    if (
      existing.imageUrl &&
      typeof existing.imageUrl === "object" &&
      (existing.imageUrl as any).id
    ) {
      try {
        await storageService.delete((existing.imageUrl as any).id);
      } catch {
        // Continue gracefully
      }
    }

    return quotationItemMasterRepo.update(id, organizationId, {
      imageUrl: imageObj as any,
    });
  }

  /**
   * Upload multiple gallery images and append to existing gallery
   */
  async uploadGalleryImages(
    id: string,
    organizationId: string,
    files: Express.Multer.File[],
  ) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    if (!files || files.length === 0) {
      throw new ErrorResponse(
        "No files provided for upload",
        statusCode.Bad_Request,
      );
    }

    const currentGallery: ImageType[] = Array.isArray(existing.galleryImages)
      ? (existing.galleryImages as unknown as ImageType[])
      : [];

    const newImages: ImageType[] = [];

    for (const file of files) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: `homio/organizations/${organizationId}/quotation/items/${id}/gallery`,
          resourceType: "image",
        },
      );

      newImages.push({
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      });
    }

    const updatedGallery = [...currentGallery, ...newImages];

    return quotationItemMasterRepo.update(id, organizationId, {
      galleryImages: updatedGallery as any,
    });
  }

  /**
   * Delete specific image from gallery
   */
  async deleteGalleryImage(
    id: string,
    imageId: string,
    organizationId: string,
  ) {
    const existing = await quotationItemMasterRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Quotation item master not found",
        statusCode.Not_Found,
      );
    }

    const currentGallery: ImageType[] = Array.isArray(existing.galleryImages)
      ? (existing.galleryImages as unknown as ImageType[])
      : [];

    const imageToRemove = currentGallery.find((img) => img.id === imageId);
    if (!imageToRemove) {
      throw new ErrorResponse(
        "Gallery image not found on this item",
        statusCode.Not_Found,
      );
    }

    // Delete from cloud storage
    try {
      await storageService.delete(imageId);
    } catch {
      // Continue gracefully
    }

    const updatedGallery = currentGallery.filter((img) => img.id !== imageId);

    return quotationItemMasterRepo.update(id, organizationId, {
      galleryImages: updatedGallery as any,
    });
  }
}

export const quotationItemMasterService = new QuotationItemMasterService();
