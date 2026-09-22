import { vendorQuotationRepo } from "../repos/vendor-quotation.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type {
  CreateVendorQuotationInput,
  UpdateVendorQuotationInput,
  CreateQuotationItemInput,
  UpdateQuotationItemInput,
  GetVendorQuotationsQueryInput,
  UpdateVendorQuotationStatusInput,
} from "../validators/vendor-quotation.validator.js";

/**
 * Service managing Vendor Quotations, Bids, commercial evaluations, and side-by-side RFQ comparisons
 */
export class VendorQuotationService {
  /**
   * Create a new Vendor Quotation / Bid
   */
  async createVendorQuotation(
    organizationId: string,
    data: CreateVendorQuotationInput,
    file?: Express.Multer.File,
    userId?: string
  ) {
    // Validate project
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in your organization", statusCode.Not_Found);
    }

    // Validate vendor
    const vendor = await prisma.vendor.findFirst({
      where: { id: data.vendorId, organizationId, isDeleted: false },
    });
    if (!vendor) {
      throw new ErrorResponse("Vendor not found in your organization", statusCode.Not_Found);
    }

    // Validate RFQ if linked
    if (data.rfqId) {
      const rfq = await prisma.vendorRfq.findFirst({
        where: { id: data.rfqId, organizationId, isDeleted: false },
      });
      if (!rfq) {
        throw new ErrorResponse("Vendor RFQ not found in your organization", statusCode.Not_Found);
      }
    }

    // Validate material request if linked
    if (data.materialRequestId) {
      const matReq = await prisma.materialRequest.findFirst({
        where: { id: data.materialRequestId, organizationId, isDeleted: false },
      });
      if (!matReq) {
        throw new ErrorResponse("Material request not found in your organization", statusCode.Not_Found);
      }
    }

    // Upload attachment if provided
    let attachmentUrl = data.attachmentUrl;
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/procurement/quotations",
          resourceType: "raw",
        }
      );
      attachmentUrl = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return vendorQuotationRepo.create(organizationId, {
      ...data,
      attachmentUrl,
      reviewedById: data.reviewedById || userId,
    });
  }

  /**
   * Get single Quotation by ID
   */
  async getVendorQuotationById(id: string, organizationId: string) {
    const quotation = await vendorQuotationRepo.findById(id, organizationId);
    if (!quotation) {
      throw new ErrorResponse("Vendor quotation not found", statusCode.Not_Found);
    }
    return quotation;
  }

  /**
   * Get paginated Quotations
   */
  async getVendorQuotations(organizationId: string, query: GetVendorQuotationsQueryInput) {
    return vendorQuotationRepo.findMany(organizationId, query);
  }

  /**
   * Compare all quotations submitted for an RFQ
   */
  async compareQuotations(rfqId: string, organizationId: string) {
    const rfq = await prisma.vendorRfq.findFirst({
      where: { id: rfqId, organizationId, isDeleted: false },
      include: {
        items: true,
      },
    });
    if (!rfq) {
      throw new ErrorResponse("Vendor RFQ not found", statusCode.Not_Found);
    }

    const quotations = await vendorQuotationRepo.findByRfqId(rfqId, organizationId);

    return {
      rfq,
      quotationCount: quotations.length,
      quotations,
    };
  }

  /**
   * Update Quotation header
   */
  async updateVendorQuotation(
    id: string,
    organizationId: string,
    data: UpdateVendorQuotationInput,
    file?: Express.Multer.File
  ) {
    await this.getVendorQuotationById(id, organizationId);

    let attachmentUrl = data.attachmentUrl;
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/procurement/quotations",
          resourceType: "raw",
        }
      );
      attachmentUrl = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return vendorQuotationRepo.update(id, organizationId, {
      ...data,
      ...(attachmentUrl !== undefined ? { attachmentUrl } : {}),
    });
  }

  /**
   * Soft-delete Quotation
   */
  async deleteVendorQuotation(id: string, organizationId: string) {
    await this.getVendorQuotationById(id, organizationId);
    return vendorQuotationRepo.softDelete(id, organizationId);
  }

  /**
   * Update status of Quotation (e.g. ACCEPTED, REJECTED, SHORTLISTED)
   */
  async updateStatus(
    id: string,
    organizationId: string,
    data: UpdateVendorQuotationStatusInput,
    userId?: string
  ) {
    await this.getVendorQuotationById(id, organizationId);
    return vendorQuotationRepo.updateStatus(
      id,
      organizationId,
      data.status,
      userId,
      data.vendorRating,
      data.evaluationNotes
    );
  }

  // ==========================================
  // Quotation Items
  // ==========================================

  async addItem(quotationId: string, organizationId: string, itemData: CreateQuotationItemInput) {
    await this.getVendorQuotationById(quotationId, organizationId);

    if (itemData.materialProductId) {
      const product = await prisma.materialProduct.findFirst({
        where: { id: itemData.materialProductId, organizationId },
      });
      if (!product) {
        throw new ErrorResponse("Material product not found in catalog", statusCode.Not_Found);
      }
    }

    return vendorQuotationRepo.addItem(quotationId, organizationId, itemData);
  }

  async updateItem(
    itemId: string,
    quotationId: string,
    organizationId: string,
    data: UpdateQuotationItemInput
  ) {
    await this.getVendorQuotationById(quotationId, organizationId);

    const existing = await prisma.vendorQuotationItem.findFirst({
      where: { id: itemId, quotationId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Quotation item not found", statusCode.Not_Found);
    }

    return vendorQuotationRepo.updateItem(itemId, quotationId, organizationId, data);
  }

  async removeItem(itemId: string, quotationId: string, organizationId: string) {
    await this.getVendorQuotationById(quotationId, organizationId);

    const existing = await prisma.vendorQuotationItem.findFirst({
      where: { id: itemId, quotationId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Quotation item not found", statusCode.Not_Found);
    }

    return vendorQuotationRepo.removeItem(itemId, quotationId, organizationId);
  }
}

export const vendorQuotationService = new VendorQuotationService();
