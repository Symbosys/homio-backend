import { quotationPdfAssetRepo } from "../repos/quotation-pdf-asset.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, PdfPageImagePosition, type ImageType } from "../../../types/types.js";
import type {
  CreatePdfAssetInput,
  UpdatePdfAssetInput,
  GetPdfAssetsQueryInput,
  ReorderPdfAssetsInput,
} from "../validators/quotation-pdf-asset.validator.js";

/**
 * Service: Quotation PDF Page Asset Management
 * Enforces max 10 FRONT / 10 BACK image quotas per tenant, handles multi-cloud storage, auto-sortOrder, and reordering
 */
export class QuotationPdfAssetService {
  /**
   * Upload and register a new PDF Page Asset with strict 10-item position quota enforcement
   */
  async createAsset(
    organizationId: string,
    input: CreatePdfAssetInput,
    file: Express.Multer.File
  ) {
    if (!file) {
      throw new ErrorResponse("Image file is required for PDF page asset", statusCode.Bad_Request);
    }

    const currentCount = await quotationPdfAssetRepo.countByPosition(organizationId, input.position);
    if (currentCount >= 10) {
      throw new ErrorResponse(
        `Maximum limit of 10 ${input.position} PDF page assets reached for your organization. Please delete an existing asset before uploading a new one.`,
        statusCode.Bad_Request
      );
    }

    // Upload image to Cloud Storage
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/quotation/pdf-assets/${input.position.toLowerCase()}`,
        resourceType: "image",
      }
    );

    const imageObj: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };

    const nextSortOrder = await quotationPdfAssetRepo.getNextSortOrder(organizationId, input.position);

    return quotationPdfAssetRepo.create(organizationId, {
      title: input.title.trim(),
      position: input.position,
      pageTag: input.pageTag || null,
      sortOrder: nextSortOrder,
      image: imageObj as any,
      isActive: input.isActive !== undefined ? input.isActive : true,
      isDefault: input.isDefault !== undefined ? input.isDefault : false,
      additionalInformation: input.additionalInformation || undefined,
    });
  }

  /**
   * List all non-paginated PDF assets for tenant
   */
  async getAssets(organizationId: string, query: GetPdfAssetsQueryInput) {
    return quotationPdfAssetRepo.findAll(organizationId, query);
  }

  /**
   * Get quota summary and usage
   */
  async getSummary(organizationId: string) {
    return quotationPdfAssetRepo.getSummary(organizationId);
  }

  /**
   * Get single PDF asset by ID
   */
  async getAssetById(id: string, organizationId: string) {
    const asset = await quotationPdfAssetRepo.findById(id, organizationId);
    if (!asset) {
      throw new ErrorResponse("PDF page asset not found", statusCode.Not_Found);
    }
    return asset;
  }

  /**
   * Update PDF Asset metadata (partial / dirty update)
   */
  async updateAsset(id: string, organizationId: string, input: UpdatePdfAssetInput) {
    const existing = await quotationPdfAssetRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("PDF page asset not found", statusCode.Not_Found);
    }

    const updatePayload: any = {
      ...input,
      title: input.title ? input.title.trim() : undefined,
      pageTag: input.pageTag !== undefined ? input.pageTag : undefined,
      additionalInformation: input.additionalInformation !== undefined ? input.additionalInformation : undefined,
    };

    return quotationPdfAssetRepo.update(id, organizationId, updatePayload);
  }

  /**
   * Soft delete PDF Asset, cleanup storage, and recompact sort orders
   */
  async deleteAsset(id: string, organizationId: string) {
    const existing = await quotationPdfAssetRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("PDF page asset not found", statusCode.Not_Found);
    }

    // Delete image from cloud storage if publicId is present
    if (existing.image && typeof existing.image === "object" && (existing.image as any).id) {
      try {
        await storageService.delete((existing.image as any).id);
      } catch {
        // Continue gracefully
      }
    }

    await quotationPdfAssetRepo.softDelete(id, organizationId);

    // Recompact remaining sort orders for the position
    await quotationPdfAssetRepo.recompactSortOrders(organizationId, existing.position);

    return { message: "PDF page asset deleted successfully" };
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const existing = await quotationPdfAssetRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("PDF page asset not found", statusCode.Not_Found);
    }

    return quotationPdfAssetRepo.toggleActive(id, existing.isActive);
  }

  /**
   * Reorder PDF page assets within a position
   */
  async reorderAssets(organizationId: string, input: ReorderPdfAssetsInput) {
    await quotationPdfAssetRepo.reorder(organizationId, input.position, input.orders);
    return { message: "PDF page assets reordered successfully" };
  }
}

export const quotationPdfAssetService = new QuotationPdfAssetService();
