import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import {
  serviceRequestRepository,
  type ServiceRequestRepository,
} from "../repos/service-request.repo.js";
import type {
  CreateServiceRequestInput,
  UpdateServiceRequestInput,
  AssignServiceRequestInput,
  ResolveServiceRequestInput,
  ReopenServiceRequestInput,
  GetServiceRequestsQueryInput,
} from "../validators/service-request.validator.js";

export class ServiceRequestService {
  constructor(private readonly repo: ServiceRequestRepository = serviceRequestRepository) {}

  /**
   * Helper to upload multiple attachment files through cloud StorageService
   */
  private async uploadMultipleAttachments(
    files: Express.Multer.File[],
    folder: string
  ): Promise<ImageType[]> {
    const uploadPromises = files.map(async (file) => {
      const res = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        { folder, resourceType: "auto" }
      );
      return {
        id: res.publicId,
        url: res.secureUrl || res.url,
        bytes: res.bytes,
        format: res.format,
        provider: res.provider,
      };
    });

    return Promise.all(uploadPromises);
  }

  /**
   * Create an after-sales service request
   */
  async createServiceRequest(
    organizationId: string,
    input: CreateServiceRequestInput,
    attachmentFiles?: Express.Multer.File[]
  ) {
    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    // Verify category belongs to organization
    const category = await prisma.serviceCategory.findFirst({
      where: { id: input.categoryId, organizationId, isDeleted: false },
    });
    if (!category) {
      throw new ErrorResponse("Service category not found within organization", statusCode.Not_Found);
    }

    if (input.warrantyId) {
      const warranty = await prisma.projectWarranty.findFirst({
        where: { id: input.warrantyId, project: { organizationId }, isDeleted: false },
      });
      if (!warranty) {
        throw new ErrorResponse("Project warranty not found within organization", statusCode.Not_Found);
      }
    }

    if (input.assignedToId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.assignedToId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Assigned employee not found within organization", statusCode.Not_Found);
      }
    }

    // Auto calculate dueDate if not explicitly provided using category SLA
    if (!input.dueDate && category.defaultSlaHours) {
      const calculatedDue = new Date();
      calculatedDue.setHours(calculatedDue.getHours() + category.defaultSlaHours);
      input.dueDate = calculatedDue.toISOString();
    }

    let attachments: ImageType[] | undefined = undefined;
    if (attachmentFiles && attachmentFiles.length > 0) {
      attachments = await this.uploadMultipleAttachments(
        attachmentFiles,
        `organizations/${organizationId}/after-sales/requests/attachments`
      );
    }

    return this.repo.create(organizationId, input, attachments);
  }

  /**
   * Get single service request by ID
   */
  async getServiceRequestById(organizationId: string, id: string) {
    const request = await this.repo.findById(organizationId, id);
    if (!request) {
      throw new ErrorResponse("Service request not found", statusCode.Not_Found);
    }
    return request;
  }

  /**
   * List paginated service requests
   */
  async getServiceRequests(organizationId: string, query: GetServiceRequestsQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Update service request details & attachments
   */
  async updateServiceRequest(
    organizationId: string,
    id: string,
    input: UpdateServiceRequestInput,
    attachmentFiles?: Express.Multer.File[]
  ) {
    const request = await this.getServiceRequestById(organizationId, id);

    let attachments: ImageType[] | undefined = undefined;
    if (attachmentFiles && attachmentFiles.length > 0) {
      const newUploads = await this.uploadMultipleAttachments(
        attachmentFiles,
        `organizations/${organizationId}/after-sales/requests/attachments`
      );
      const existing = (request.attachments as unknown as ImageType[]) || [];
      attachments = [...existing, ...newUploads];
    }

    return this.repo.update(organizationId, id, input, attachments);
  }

  /**
   * Assign or re-assign technician
   */
  async assignServiceRequest(
    organizationId: string,
    id: string,
    input: AssignServiceRequestInput
  ) {
    await this.getServiceRequestById(organizationId, id);

    const employee = await prisma.employee.findFirst({
      where: { id: input.assignedToId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Employee not found within organization", statusCode.Not_Found);
    }

    return this.repo.assign(organizationId, id, input);
  }

  /**
   * Update status
   */
  async updateStatus(
    organizationId: string,
    id: string,
    status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_FOR_PARTS" | "ON_HOLD" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED"
  ) {
    await this.getServiceRequestById(organizationId, id);
    return this.repo.updateStatus(organizationId, id, status);
  }

  /**
   * Resolve service request
   */
  async resolveServiceRequest(
    organizationId: string,
    id: string,
    input: ResolveServiceRequestInput
  ) {
    const request = await this.getServiceRequestById(organizationId, id);
    if (request.status === "CLOSED" || request.status === "CANCELLED") {
      throw new ErrorResponse(
        `Cannot resolve a service request in status "${request.status}"`,
        statusCode.Bad_Request
      );
    }
    return this.repo.resolve(organizationId, id, input);
  }

  /**
   * Close service request
   */
  async closeServiceRequest(organizationId: string, id: string) {
    const request = await this.getServiceRequestById(organizationId, id);
    if (request.status !== "RESOLVED") {
      throw new ErrorResponse(
        "Only resolved service requests can be closed. Please resolve the request first.",
        statusCode.Bad_Request
      );
    }
    return this.repo.close(organizationId, id);
  }

  /**
   * Reopen service request
   */
  async reopenServiceRequest(
    organizationId: string,
    id: string,
    input: ReopenServiceRequestInput
  ) {
    const request = await this.getServiceRequestById(organizationId, id);
    if (request.status !== "RESOLVED" && request.status !== "CLOSED") {
      throw new ErrorResponse(
        "Only resolved or closed service requests can be reopened.",
        statusCode.Bad_Request
      );
    }
    return this.repo.reopen(organizationId, id, input);
  }

  /**
   * Soft delete service request
   */
  async deleteServiceRequest(organizationId: string, id: string) {
    await this.getServiceRequestById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const serviceRequestService = new ServiceRequestService();
