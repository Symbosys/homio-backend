import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import {
  warrantyRepository,
  type WarrantyRepository,
} from "../repos/warranty.repo.js";
import type {
  CreateProjectWarrantyInput,
  UpdateProjectWarrantyInput,
  GetProjectWarrantiesQueryInput,
} from "../validators/warranty.validator.js";

export class WarrantyService {
  constructor(private readonly repo: WarrantyRepository = warrantyRepository) {}

  /**
   * Helper to upload file buffer through cloud StorageService
   */
  private async uploadToCloud(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "raw" | "auto" = "auto"
  ): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder, resourceType }
    );

    return {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };
  }

  /**
   * Create a new project warranty
   */
  async createWarranty(
    organizationId: string,
    input: CreateProjectWarrantyInput,
    policyDocFile?: Express.Multer.File
  ) {
    // Verify project belongs to tenant organization
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    if (input.handoverId) {
      const handover = await prisma.projectHandover.findFirst({
        where: { id: input.handoverId, organizationId, isDeleted: false },
      });
      if (!handover) {
        throw new ErrorResponse("Handover docket not found within organization", statusCode.Not_Found);
      }
    }

    if (new Date(input.startDate) > new Date(input.endDate)) {
      throw new ErrorResponse("Warranty startDate cannot be after endDate", statusCode.Bad_Request);
    }

    let policyDocumentUrl: ImageType | null = null;
    if (policyDocFile) {
      policyDocumentUrl = await this.uploadToCloud(
        policyDocFile,
        `organizations/${organizationId}/after-sales/warranties/policy`,
        "auto"
      );
    }

    return this.repo.create(organizationId, input, policyDocumentUrl);
  }

  /**
   * Get warranty by ID
   */
  async getWarrantyById(organizationId: string, id: string) {
    const warranty = await this.repo.findById(organizationId, id);
    if (!warranty) {
      throw new ErrorResponse("Project warranty not found", statusCode.Not_Found);
    }
    return warranty;
  }

  /**
   * List paginated warranties
   */
  async getWarranties(organizationId: string, query: GetProjectWarrantiesQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Update warranty details & file
   */
  async updateWarranty(
    organizationId: string,
    id: string,
    input: UpdateProjectWarrantyInput,
    policyDocFile?: Express.Multer.File
  ) {
    const existing = await this.getWarrantyById(organizationId, id);

    const start = input.startDate ? new Date(input.startDate) : existing.startDate;
    const end = input.endDate ? new Date(input.endDate) : existing.endDate;
    if (start > end) {
      throw new ErrorResponse("Warranty startDate cannot be after endDate", statusCode.Bad_Request);
    }

    let policyDocumentUrl: ImageType | null | undefined = undefined;
    if (policyDocFile) {
      policyDocumentUrl = await this.uploadToCloud(
        policyDocFile,
        `organizations/${organizationId}/after-sales/warranties/policy`,
        "auto"
      );
    }

    return this.repo.update(organizationId, id, input, policyDocumentUrl);
  }

  /**
   * Update status
   */
  async updateWarrantyStatus(
    organizationId: string,
    id: string,
    status: "ACTIVE" | "EXPIRED" | "CLAIMED" | "VOIDED"
  ) {
    await this.getWarrantyById(organizationId, id);
    return this.repo.updateStatus(organizationId, id, status);
  }

  /**
   * Soft delete warranty
   */
  async deleteWarranty(organizationId: string, id: string) {
    await this.getWarrantyById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const warrantyService = new WarrantyService();
