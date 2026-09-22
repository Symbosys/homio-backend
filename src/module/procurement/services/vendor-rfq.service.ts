import { vendorRfqRepo } from "../repos/vendor-rfq.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateVendorRfqInput,
  UpdateVendorRfqInput,
  CreateRfqItemInput,
  UpdateRfqItemInput,
  CreateRfqInviteInput,
  UpdateRfqInviteInput,
  GetVendorRfqsQueryInput,
  UpdateVendorRfqStatusInput,
} from "../validators/vendor-rfq.validator.js";

/**
 * Service managing Vendor RFQs, vendor invitations, and quote collation
 */
export class VendorRfqService {
  /**
   * Create a new RFQ with items and vendor invites
   */
  async createVendorRfq(
    organizationId: string,
    data: CreateVendorRfqInput,
    userId?: string
  ) {
    // Validate project
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in your organization", statusCode.Not_Found);
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

    // Validate invited vendors if provided
    if (data.vendorIds && data.vendorIds.length > 0) {
      const count = await prisma.vendor.count({
        where: {
          id: { in: data.vendorIds },
          organizationId,
          isDeleted: false,
        },
      });
      if (count !== data.vendorIds.length) {
        throw new ErrorResponse("One or more invited vendors do not exist in your organization", statusCode.Bad_Request);
      }
    }

    return vendorRfqRepo.create(organizationId, {
      ...data,
      createdById: data.createdById || userId,
    });
  }

  /**
   * Get single RFQ by ID
   */
  async getVendorRfqById(id: string, organizationId: string) {
    const rfq = await vendorRfqRepo.findById(id, organizationId);
    if (!rfq) {
      throw new ErrorResponse("Vendor RFQ not found", statusCode.Not_Found);
    }
    return rfq;
  }

  /**
   * Get paginated RFQs
   */
  async getVendorRfqs(organizationId: string, query: GetVendorRfqsQueryInput) {
    return vendorRfqRepo.findMany(organizationId, query);
  }

  /**
   * Update RFQ header
   */
  async updateVendorRfq(id: string, organizationId: string, data: UpdateVendorRfqInput) {
    await this.getVendorRfqById(id, organizationId);

    if (data.materialRequestId) {
      const matReq = await prisma.materialRequest.findFirst({
        where: { id: data.materialRequestId, organizationId, isDeleted: false },
      });
      if (!matReq) {
        throw new ErrorResponse("Material request not found in your organization", statusCode.Not_Found);
      }
    }

    return vendorRfqRepo.update(id, organizationId, data);
  }

  /**
   * Soft-delete RFQ
   */
  async deleteVendorRfq(id: string, organizationId: string) {
    await this.getVendorRfqById(id, organizationId);
    return vendorRfqRepo.softDelete(id, organizationId);
  }

  /**
   * Update status of RFQ
   */
  async updateStatus(id: string, organizationId: string, data: UpdateVendorRfqStatusInput) {
    await this.getVendorRfqById(id, organizationId);
    return vendorRfqRepo.updateStatus(id, organizationId, data.status, data.notes);
  }

  // ==========================================
  // RFQ Items
  // ==========================================

  async addItem(rfqId: string, organizationId: string, itemData: CreateRfqItemInput) {
    await this.getVendorRfqById(rfqId, organizationId);

    if (itemData.materialProductId) {
      const product = await prisma.materialProduct.findFirst({
        where: { id: itemData.materialProductId, organizationId },
      });
      if (!product) {
        throw new ErrorResponse("Material product not found in catalog", statusCode.Not_Found);
      }
    }

    return vendorRfqRepo.addItem(rfqId, organizationId, itemData);
  }

  async updateItem(
    itemId: string,
    rfqId: string,
    organizationId: string,
    data: UpdateRfqItemInput
  ) {
    await this.getVendorRfqById(rfqId, organizationId);

    const existing = await prisma.vendorRfqItem.findFirst({
      where: { id: itemId, rfqId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("RFQ item not found", statusCode.Not_Found);
    }

    return vendorRfqRepo.updateItem(itemId, rfqId, organizationId, data);
  }

  async removeItem(itemId: string, rfqId: string, organizationId: string) {
    await this.getVendorRfqById(rfqId, organizationId);

    const existing = await prisma.vendorRfqItem.findFirst({
      where: { id: itemId, rfqId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("RFQ item not found", statusCode.Not_Found);
    }

    return vendorRfqRepo.removeItem(itemId, rfqId, organizationId);
  }

  // ==========================================
  // RFQ Invites
  // ==========================================

  async inviteVendor(rfqId: string, organizationId: string, inviteData: CreateRfqInviteInput) {
    await this.getVendorRfqById(rfqId, organizationId);

    // Validate vendor exists
    const vendor = await prisma.vendor.findFirst({
      where: { id: inviteData.vendorId, organizationId, isDeleted: false },
    });
    if (!vendor) {
      throw new ErrorResponse("Vendor not found in your organization", statusCode.Not_Found);
    }

    // Check if already invited
    const existingInvite = await prisma.vendorRfqInvite.findUnique({
      where: {
        rfqId_vendorId: {
          rfqId,
          vendorId: inviteData.vendorId,
        },
      },
    });
    if (existingInvite) {
      throw new ErrorResponse("Vendor has already been invited to this RFQ", statusCode.Conflict);
    }

    return vendorRfqRepo.addInvite(rfqId, organizationId, inviteData);
  }

  async getInvites(rfqId: string, organizationId: string) {
    await this.getVendorRfqById(rfqId, organizationId);
    return vendorRfqRepo.findInvites(rfqId, organizationId);
  }

  async updateInvite(
    inviteId: string,
    rfqId: string,
    organizationId: string,
    data: UpdateRfqInviteInput
  ) {
    await this.getVendorRfqById(rfqId, organizationId);

    const existing = await prisma.vendorRfqInvite.findFirst({
      where: { id: inviteId, rfqId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Vendor invite not found", statusCode.Not_Found);
    }

    return vendorRfqRepo.updateInvite(inviteId, rfqId, organizationId, data);
  }

  async removeInvite(inviteId: string, rfqId: string, organizationId: string) {
    await this.getVendorRfqById(rfqId, organizationId);

    const existing = await prisma.vendorRfqInvite.findFirst({
      where: { id: inviteId, rfqId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Vendor invite not found", statusCode.Not_Found);
    }

    return vendorRfqRepo.removeInvite(inviteId, rfqId, organizationId);
  }
}

export const vendorRfqService = new VendorRfqService();
