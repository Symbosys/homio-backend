import { materialDispatchRepo } from "../repos/material-dispatch.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type {
  CreateMaterialDispatchInput,
  UpdateMaterialDispatchInput,
  CreateDispatchItemInput,
  UpdateDispatchItemInput,
  BulkReceiveDispatchInput,
  GetMaterialDispatchesQueryInput,
  UpdateMaterialDispatchStatusInput,
} from "../validators/material-dispatch.validator.js";

/**
 * Service managing Material Dispatches, logistics tracking, site gate receipts, and QA verification
 */
export class MaterialDispatchService {
  /**
   * Create a new Material Dispatch consignment
   */
  async createMaterialDispatch(
    organizationId: string,
    data: CreateMaterialDispatchInput,
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

    // Validate material request if linked
    if (data.materialRequestId) {
      const matReq = await prisma.materialRequest.findFirst({
        where: { id: data.materialRequestId, organizationId, isDeleted: false },
      });
      if (!matReq) {
        throw new ErrorResponse("Material request not found in your organization", statusCode.Not_Found);
      }
    }

    // Validate quotation if linked
    if (data.quotationId) {
      const quote = await prisma.vendorQuotation.findFirst({
        where: { id: data.quotationId, organizationId, isDeleted: false },
      });
      if (!quote) {
        throw new ErrorResponse("Vendor quotation not found in your organization", statusCode.Not_Found);
      }
    }

    return materialDispatchRepo.create(organizationId, {
      ...data,
      receivedById: data.receivedById || userId,
    });
  }

  /**
   * Get single Dispatch by ID
   */
  async getMaterialDispatchById(id: string, organizationId: string) {
    const dispatch = await materialDispatchRepo.findById(id, organizationId);
    if (!dispatch) {
      throw new ErrorResponse("Material dispatch consignment not found", statusCode.Not_Found);
    }
    return dispatch;
  }

  /**
   * Get paginated Dispatches
   */
  async getMaterialDispatches(organizationId: string, query: GetMaterialDispatchesQueryInput) {
    return materialDispatchRepo.findMany(organizationId, query);
  }

  /**
   * Update Dispatch header
   */
  async updateMaterialDispatch(
    id: string,
    organizationId: string,
    data: UpdateMaterialDispatchInput
  ) {
    await this.getMaterialDispatchById(id, organizationId);
    return materialDispatchRepo.update(id, organizationId, data);
  }

  /**
   * Soft-delete Dispatch
   */
  async deleteMaterialDispatch(id: string, organizationId: string) {
    await this.getMaterialDispatchById(id, organizationId);
    return materialDispatchRepo.softDelete(id, organizationId);
  }

  /**
   * Update status of Dispatch
   */
  async updateStatus(id: string, organizationId: string, data: UpdateMaterialDispatchStatusInput) {
    await this.getMaterialDispatchById(id, organizationId);
    return materialDispatchRepo.updateStatus(
      id,
      organizationId,
      data.status,
      data.actualArrival,
      data.siteInspectionNotes
    );
  }

  /**
   * Bulk receive items and QA verify at site gate
   */
  async bulkReceive(
    id: string,
    organizationId: string,
    data: BulkReceiveDispatchInput,
    userId?: string
  ) {
    const dispatch = await this.getMaterialDispatchById(id, organizationId);

    // Verify all item IDs belong to this dispatch
    const existingItemIds = new Set(dispatch.items.map((i) => i.id));
    for (const item of data.items) {
      if (!existingItemIds.has(item.id)) {
        throw new ErrorResponse(
          `Dispatch item '${item.id}' does not belong to this consignment`,
          statusCode.Bad_Request
        );
      }
    }

    return materialDispatchRepo.bulkReceive(id, organizationId, data, userId);
  }

  /**
   * Upload site supervisor signature and proof of delivery images
   */
  async uploadSignatureAndProof(
    id: string,
    organizationId: string,
    files: {
      signature?: Express.Multer.File[];
      proof?: Express.Multer.File[];
    },
    notes?: string
  ) {
    await this.getMaterialDispatchById(id, organizationId);

    let siteSupervisorSignature: any = undefined;
    let deliveryProofUrl: any = undefined;

    if (files.signature && files.signature[0]) {
      const sigFile = files.signature[0];
      const uploadResult = await storageService.upload(
        {
          buffer: sigFile.buffer,
          originalname: sigFile.originalname,
          mimetype: sigFile.mimetype,
          size: sigFile.size,
        },
        {
          folder: "homio/procurement/signatures",
          resourceType: "image",
        }
      );
      siteSupervisorSignature = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    if (files.proof && files.proof[0]) {
      const proofFile = files.proof[0];
      const uploadResult = await storageService.upload(
        {
          buffer: proofFile.buffer,
          originalname: proofFile.originalname,
          mimetype: proofFile.mimetype,
          size: proofFile.size,
        },
        {
          folder: "homio/procurement/delivery-proofs",
          resourceType: "image",
        }
      );
      deliveryProofUrl = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return materialDispatchRepo.update(id, organizationId, {
      ...(siteSupervisorSignature ? { siteSupervisorSignature } : {}),
      ...(deliveryProofUrl ? { deliveryProofUrl } : {}),
      ...(notes ? { siteInspectionNotes: notes } : {}),
    });
  }

  // ==========================================
  // Dispatch Items
  // ==========================================

  async addItem(dispatchId: string, organizationId: string, itemData: CreateDispatchItemInput) {
    await this.getMaterialDispatchById(dispatchId, organizationId);

    if (itemData.materialProductId) {
      const product = await prisma.materialProduct.findFirst({
        where: { id: itemData.materialProductId, organizationId },
      });
      if (!product) {
        throw new ErrorResponse("Material product not found in catalog", statusCode.Not_Found);
      }
    }

    return materialDispatchRepo.addItem(dispatchId, organizationId, itemData);
  }

  async updateItem(
    itemId: string,
    dispatchId: string,
    organizationId: string,
    data: UpdateDispatchItemInput
  ) {
    await this.getMaterialDispatchById(dispatchId, organizationId);

    const existing = await prisma.materialDispatchItem.findFirst({
      where: { id: itemId, dispatchId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Dispatch item not found", statusCode.Not_Found);
    }

    return materialDispatchRepo.updateItem(itemId, dispatchId, organizationId, data);
  }

  async removeItem(itemId: string, dispatchId: string, organizationId: string) {
    await this.getMaterialDispatchById(dispatchId, organizationId);

    const existing = await prisma.materialDispatchItem.findFirst({
      where: { id: itemId, dispatchId, organizationId },
    });
    if (!existing) {
      throw new ErrorResponse("Dispatch item not found", statusCode.Not_Found);
    }

    return materialDispatchRepo.removeItem(itemId, dispatchId, organizationId);
  }
}

export const materialDispatchService = new MaterialDispatchService();
