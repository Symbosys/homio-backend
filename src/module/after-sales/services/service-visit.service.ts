import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import {
  serviceVisitRepository,
  type ServiceVisitRepository,
} from "../repos/service-visit.repo.js";
import type {
  CreateServiceVisitInput,
  UpdateServiceVisitInput,
  CheckInServiceVisitInput,
  SubmitWorkReportInput,
  SignOffServiceVisitInput,
  GetServiceVisitsQueryInput,
} from "../validators/service-visit.validator.js";

export class ServiceVisitService {
  constructor(private readonly repo: ServiceVisitRepository = serviceVisitRepository) {}

  /**
   * Helper to upload single file buffer
   */
  private async uploadSingleFile(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "raw" | "auto" = "image"
  ): Promise<ImageType> {
    const res = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder, resourceType }
    );
    return {
      id: res.publicId,
      url: res.secureUrl || res.url,
      bytes: res.bytes,
      format: res.format,
      provider: res.provider,
    };
  }

  /**
   * Helper to upload multiple files
   */
  private async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string
  ): Promise<ImageType[]> {
    const promises = files.map((file) => this.uploadSingleFile(file, folder, "image"));
    return Promise.all(promises);
  }

  /**
   * Schedule a technician field visit
   */
  async createVisit(organizationId: string, input: CreateServiceVisitInput) {
    let resolvedProjectId = input.projectId;

    if (!resolvedProjectId) {
      const requestRecord = await prisma.afterSalesServiceRequest.findFirst({
        where: { id: input.serviceRequestId, isDeleted: false },
        select: { projectId: true },
      });
      if (!requestRecord) {
        throw new ErrorResponse("Service request not found", statusCode.Not_Found);
      }
      resolvedProjectId = requestRecord.projectId;
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
      where: { id: resolvedProjectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    // Verify service request belongs to this project
    const request = await prisma.afterSalesServiceRequest.findFirst({
      where: { id: input.serviceRequestId, projectId: resolvedProjectId, isDeleted: false },
    });
    if (!request) {
      throw new ErrorResponse(
        "Service request not found under the specified project",
        statusCode.Not_Found
      );
    }

    if (input.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.assignedEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Technician employee not found within organization", statusCode.Not_Found);
      }
    }

    return this.repo.create(organizationId, {
      ...input,
      projectId: resolvedProjectId,
    });
  }

  /**
   * Get single visit by ID
   */
  async getVisitById(organizationId: string, id: string) {
    const visit = await this.repo.findById(organizationId, id);
    if (!visit) {
      throw new ErrorResponse("Service visit not found", statusCode.Not_Found);
    }
    return visit;
  }

  /**
   * List paginated service visits
   */
  async getVisits(organizationId: string, query: GetServiceVisitsQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Partial update visit details
   */
  async updateVisit(organizationId: string, id: string, input: UpdateServiceVisitInput) {
    await this.getVisitById(organizationId, id);

    if (input.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.assignedEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Technician employee not found within organization", statusCode.Not_Found);
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  /**
   * Technician mobile check-in
   */
  async checkIn(
    organizationId: string,
    id: string,
    input: CheckInServiceVisitInput,
    checkInPhotoFile?: Express.Multer.File
  ) {
    await this.getVisitById(organizationId, id);

    let checkInPhotoUrl: ImageType | null = null;
    if (checkInPhotoFile) {
      checkInPhotoUrl = await this.uploadSingleFile(
        checkInPhotoFile,
        `organizations/${organizationId}/after-sales/visits/check-in`
      );
    }

    return this.repo.checkIn(organizationId, id, input, checkInPhotoUrl);
  }

  /**
   * Submit field work report
   */
  async submitWorkReport(
    organizationId: string,
    id: string,
    input: SubmitWorkReportInput,
    beforeFiles?: Express.Multer.File[],
    afterFiles?: Express.Multer.File[]
  ) {
    const visit = await this.getVisitById(organizationId, id);

    let beforePhotoUrls: ImageType[] | undefined = undefined;
    if (beforeFiles && beforeFiles.length > 0) {
      const newBefore = await this.uploadMultipleFiles(
        beforeFiles,
        `organizations/${organizationId}/after-sales/visits/before`
      );
      const existing = (visit.beforePhotoUrls as unknown as ImageType[]) || [];
      beforePhotoUrls = [...existing, ...newBefore];
    }

    let afterPhotoUrls: ImageType[] | undefined = undefined;
    if (afterFiles && afterFiles.length > 0) {
      const newAfter = await this.uploadMultipleFiles(
        afterFiles,
        `organizations/${organizationId}/after-sales/visits/after`
      );
      const existing = (visit.afterPhotoUrls as unknown as ImageType[]) || [];
      afterPhotoUrls = [...existing, ...newAfter];
    }

    return this.repo.submitWorkReport(
      organizationId,
      id,
      input,
      beforePhotoUrls,
      afterPhotoUrls
    );
  }

  /**
   * Customer digital touch sign-off
   */
  async signOff(
    organizationId: string,
    id: string,
    input: SignOffServiceVisitInput,
    signatureFile?: Express.Multer.File
  ) {
    await this.getVisitById(organizationId, id);

    let customerSignatureUrl: ImageType | null = null;
    if (signatureFile) {
      customerSignatureUrl = await this.uploadSingleFile(
        signatureFile,
        `organizations/${organizationId}/after-sales/visits/signatures`
      );
    }

    return this.repo.signOff(organizationId, id, input, customerSignatureUrl);
  }

  /**
   * Update status
   */
  async updateStatus(
    organizationId: string,
    id: string,
    status: "SCHEDULED" | "DISPATCHED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" | "RESCHEDULED"
  ) {
    await this.getVisitById(organizationId, id);
    return this.repo.updateStatus(organizationId, id, status);
  }

  /**
   * Soft delete visit
   */
  async deleteVisit(organizationId: string, id: string) {
    await this.getVisitById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const serviceVisitService = new ServiceVisitService();
