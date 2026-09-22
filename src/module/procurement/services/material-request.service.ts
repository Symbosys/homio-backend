import { materialRequestRepo } from "../repos/material-request.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateMaterialRequestInput,
  UpdateMaterialRequestInput,
  CreateMaterialRequestItemInput,
  UpdateMaterialRequestItemInput,
  GetMaterialRequestsQueryInput,
  UpdateMaterialRequestStatusInput,
} from "../validators/material-request.validator.js";

/**
 * Service managing Material Requisitions, site indents, approval workflows, and line items
 */
export class MaterialRequestService {
  /**
   * Create a new Material Request for a project
   */
  async createMaterialRequest(organizationId: string, data: CreateMaterialRequestInput) {
    // Validate project existence and tenancy
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in your organization", statusCode.Not_Found);
    }

    // Validate optional MaterialProduct IDs if items are provided
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item.materialProductId) {
          const product = await prisma.materialProduct.findFirst({
            where: { id: item.materialProductId, organizationId },
          });
          if (!product) {
            throw new ErrorResponse(
              `Material product '${item.materialProductId}' not found in catalog`,
              statusCode.Not_Found
            );
          }
        }
      }
    }

    return materialRequestRepo.create(organizationId, data);
  }

  /**
   * Get single Material Request by ID
   */
  async getMaterialRequestById(id: string, organizationId: string) {
    const request = await materialRequestRepo.findById(id, organizationId);
    if (!request) {
      throw new ErrorResponse("Material request not found", statusCode.Not_Found);
    }
    return request;
  }

  /**
   * Get paginated Material Requests with filters
   */
  async getMaterialRequests(organizationId: string, query: GetMaterialRequestsQueryInput) {
    return materialRequestRepo.findMany(organizationId, query);
  }

  /**
   * Update Material Request header
   */
  async updateMaterialRequest(
    id: string,
    organizationId: string,
    data: UpdateMaterialRequestInput
  ) {
    await this.getMaterialRequestById(id, organizationId);
    return materialRequestRepo.update(id, organizationId, data);
  }

  /**
   * Soft-delete Material Request
   */
  async deleteMaterialRequest(id: string, organizationId: string) {
    await this.getMaterialRequestById(id, organizationId);
    return materialRequestRepo.softDelete(id, organizationId);
  }

  /**
   * Update status of Material Request
   */
  async updateStatus(
    id: string,
    organizationId: string,
    data: UpdateMaterialRequestStatusInput,
    userId?: string
  ) {
    const existing = await this.getMaterialRequestById(id, organizationId);

    const approvedById = data.status === "APPROVED" ? userId : undefined;
    return materialRequestRepo.updateStatus(
      id,
      organizationId,
      data.status,
      approvedById,
      data.approvedCost,
      data.notes
    );
  }

  // ==========================================
  // Item Operations
  // ==========================================

  /**
   * Add a line item to a Material Request
   */
  async addItem(
    requestId: string,
    organizationId: string,
    itemData: CreateMaterialRequestItemInput
  ) {
    await this.getMaterialRequestById(requestId, organizationId);

    if (itemData.materialProductId) {
      const product = await prisma.materialProduct.findFirst({
        where: { id: itemData.materialProductId, organizationId },
      });
      if (!product) {
        throw new ErrorResponse("Material product not found in catalog", statusCode.Not_Found);
      }
    }

    return materialRequestRepo.addItem(requestId, organizationId, itemData);
  }

  /**
   * Update a line item in a Material Request
   */
  async updateItem(
    itemId: string,
    requestId: string,
    organizationId: string,
    data: UpdateMaterialRequestItemInput
  ) {
    await this.getMaterialRequestById(requestId, organizationId);

    if (data.materialProductId) {
      const product = await prisma.materialProduct.findFirst({
        where: { id: data.materialProductId, organizationId },
      });
      if (!product) {
        throw new ErrorResponse("Material product not found in catalog", statusCode.Not_Found);
      }
    }

    const updated = await materialRequestRepo.updateItem(itemId, requestId, organizationId, data);
    if (!updated) {
      throw new ErrorResponse("Material request item not found", statusCode.Not_Found);
    }
    return updated;
  }

  /**
   * Remove a line item from a Material Request
   */
  async removeItem(itemId: string, requestId: string, organizationId: string) {
    await this.getMaterialRequestById(requestId, organizationId);

    const removed = await materialRequestRepo.removeItem(itemId, requestId, organizationId);
    if (!removed) {
      throw new ErrorResponse("Material request item not found", statusCode.Not_Found);
    }
    return removed;
  }
}

export const materialRequestService = new MaterialRequestService();
