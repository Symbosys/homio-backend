import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import {
  claimRepository,
  type ClaimRepository,
} from "../repos/claim.repo.js";
import { serviceRequestRepository } from "../repos/service-request.repo.js";
import type {
  CreateWarrantyClaimInput,
  UpdateWarrantyClaimInput,
  ReviewWarrantyClaimInput,
  GetWarrantyClaimsQueryInput,
} from "../validators/claim.validator.js";

export class ClaimService {
  constructor(private readonly repo: ClaimRepository = claimRepository) {}

  /**
   * Helper to upload multiple evidence photos through cloud StorageService
   */
  private async uploadMultiplePhotos(
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
        { folder, resourceType: "image" }
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
   * File a new warranty claim
   */
  async createClaim(
    organizationId: string,
    input: CreateWarrantyClaimInput,
    photoFiles?: Express.Multer.File[]
  ) {
    // Verify warranty exists and belongs to tenant
    const warranty = await prisma.projectWarranty.findFirst({
      where: {
        id: input.warrantyId,
        project: { organizationId },
        isDeleted: false,
      },
    });
    if (!warranty) {
      throw new ErrorResponse("Warranty not found within organization", statusCode.Not_Found);
    }

    if (warranty.status !== "ACTIVE") {
      throw new ErrorResponse(
        `Cannot file claim on a warranty with status "${warranty.status}"`,
        statusCode.Bad_Request
      );
    }

    let evidencePhotos: ImageType[] | undefined = undefined;
    if (photoFiles && photoFiles.length > 0) {
      evidencePhotos = await this.uploadMultiplePhotos(
        photoFiles,
        `organizations/${organizationId}/after-sales/claims/evidence`
      );
    }

    return this.repo.create(organizationId, input, evidencePhotos);
  }

  /**
   * Get single claim by ID
   */
  async getClaimById(organizationId: string, id: string) {
    const claim = await this.repo.findById(organizationId, id);
    if (!claim) {
      throw new ErrorResponse("Warranty claim not found", statusCode.Not_Found);
    }
    return claim;
  }

  /**
   * List paginated warranty claims
   */
  async getClaims(organizationId: string, query: GetWarrantyClaimsQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Update claim details & evidence photos (Rule 19 Symmetrical Editability)
   */
  async updateClaim(
    organizationId: string,
    id: string,
    input: UpdateWarrantyClaimInput,
    photoFiles?: Express.Multer.File[]
  ) {
    const claim = await this.getClaimById(organizationId, id);

    if (input.warrantyId && input.warrantyId !== claim.warrantyId) {
      const warranty = await prisma.projectWarranty.findFirst({
        where: {
          id: input.warrantyId,
          project: { organizationId },
          isDeleted: false,
        },
      });
      if (!warranty) {
        throw new ErrorResponse("Target warranty not found within organization", statusCode.Not_Found);
      }
    }

    let evidencePhotos: ImageType[] | undefined = undefined;
    if (photoFiles && photoFiles.length > 0) {
      const newPhotos = await this.uploadMultiplePhotos(
        photoFiles,
        `organizations/${organizationId}/after-sales/claims/evidence`
      );
      const existingPhotos = (claim.evidencePhotos as unknown as ImageType[]) || [];
      evidencePhotos = [...existingPhotos, ...newPhotos];
    }

    return this.repo.update(organizationId, id, input, evidencePhotos);
  }

  /**
   * Review claim (Approve / Reject)
   */
  async reviewClaim(
    organizationId: string,
    id: string,
    userId: string,
    input: ReviewWarrantyClaimInput
  ) {
    const claim = await this.getClaimById(organizationId, id);

    if (input.status === "REJECTED" && !input.rejectionReason) {
      throw new ErrorResponse("Rejection reason is required when rejecting a claim", statusCode.Bad_Request);
    }

    // Safely lookup reviewer employee in organization to avoid foreign key violations
    let reviewerEmployeeId: string | null = null;
    if (userId) {
      const employee = await prisma.employee.findFirst({
        where: {
          organizationId,
          OR: [
            { userId },
            { id: userId },
          ],
          isDeleted: false,
        },
        select: { id: true },
      });
      if (employee) {
        reviewerEmployeeId = employee.id;
      }
    }

    return this.repo.review(organizationId, id, reviewerEmployeeId, input);
  }

  /**
   * Spawn a service request work order from an approved warranty claim
   */
  async spawnServiceRequestFromClaim(organizationId: string, claimId: string) {
    const claim = await this.getClaimById(organizationId, claimId);

    if (claim.status !== "APPROVED") {
      throw new ErrorResponse(
        `Cannot create service request for claim in status "${claim.status}". Claim must be APPROVED.`,
        statusCode.Bad_Request
      );
    }

    if (claim.serviceRequestId) {
      throw new ErrorResponse(
        "A service request has already been generated for this claim",
        statusCode.Conflict
      );
    }

    // Resolve or find a default ServiceCategory for warranty rectifications
    const defaultCategory = await prisma.serviceCategory.findFirst({
      where: { organizationId, isDeleted: false },
      orderBy: { sortOrder: "asc" },
    });
    if (!defaultCategory) {
      throw new ErrorResponse(
        "Please configure at least one service category before creating service requests",
        statusCode.Bad_Request
      );
    }

    const serviceRequest = await serviceRequestRepository.create(
      organizationId,
      {
        projectId: claim.warranty.projectId,
        categoryId: defaultCategory.id,
        warrantyId: claim.warrantyId,
        priority: "HIGH",
        subject: `Warranty Rectification: ${claim.title}`,
        description: `Spawned from Claim ${claim.claimNumber}: ${claim.description}`,
        areaRoom: claim.areaRoom,
        isWarrantyCovered: true,
        billingStatus: "FREE_UNDER_WARRANTY",
      },
      (claim.evidencePhotos as unknown as ImageType[]) || undefined
    );

    // Link claim to service request
    await this.repo.linkServiceRequest(organizationId, claimId, serviceRequest.id);

    return serviceRequest;
  }

  /**
   * Soft delete claim
   */
  async deleteClaim(organizationId: string, id: string) {
    await this.getClaimById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const claimService = new ClaimService();
