import { incentiveRepo } from "../repos/incentive.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreateIncentiveInput,
  GetIncentivesQueryInput,
  GetMyIncentivesQueryInput,
  UpdateIncentiveInput,
} from "../validators/incentive.validator.js";

export class IncentiveService {
  /**
   * Helper: Resolve employee profile for current logged-in user
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Employee profile not found for your user account", statusCode.Forbidden);
    }
    return employee;
  }

  /**
   * Helper: Upload supporting documents / receipts
   */
  private async uploadDocuments(
    files: Express.Multer.File[] | undefined,
    organizationId: string
  ): Promise<ImageType[]> {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file) =>
      storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/incentives/documents`,
          resourceType: "auto",
        }
      )
    );

    const results = await Promise.all(uploadPromises);

    return results.map((res, index) => ({
      id: res.publicId,
      url: res.secureUrl || res.url,
      bytes: res.bytes || files[index]?.size || 0,
      format: res.format || "pdf",
      provider: res.provider || "cloudinary",
    }));
  }

  /**
   * Create an incentive / debit transaction
   */
  async createIncentive(
    organizationId: string,
    creatorUserId: string,
    input: CreateIncentiveInput,
    files?: Express.Multer.File[]
  ) {
    // 1. Verify target employee belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Target employee not found in your organization", statusCode.Not_Found);
    }

    // 2. Upload any supporting documents / receipts
    const uploadedDocs = await this.uploadDocuments(files, organizationId);

    const effectiveDate = input.effectiveDate
      ? new Date(`${input.effectiveDate}T00:00:00.000Z`)
      : new Date();

    return incentiveRepo.create({
      employeeId: input.employeeId,
      type: input.type,
      amount: input.amount,
      currency: input.currency || "INR",
      reason: input.reason,
      description: input.description,
      remarks: input.remarks,
      effectiveDate,
      createdById: creatorUserId,
      documents: uploadedDocs.length > 0 ? uploadedDocs : undefined,
    });
  }

  /**
   * List all incentives for organization (Admin / HR)
   */
  async getAllIncentives(organizationId: string, filters: GetIncentivesQueryInput) {
    return incentiveRepo.findAll(organizationId, filters);
  }

  /**
   * List personal incentives for logged-in employee
   */
  async getMyIncentives(
    organizationId: string,
    userId: string,
    filters: GetMyIncentivesQueryInput
  ) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return incentiveRepo.findMyIncentives(employee.id, organizationId, filters);
  }

  /**
   * Get organization aggregate metrics
   */
  async getSummaryMetrics(organizationId: string) {
    return incentiveRepo.getSummaryMetrics(organizationId);
  }

  /**
   * Get single incentive by ID
   */
  async getIncentiveById(id: string, organizationId: string) {
    const incentive = await incentiveRepo.findById(id, organizationId);
    if (!incentive) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    return incentive;
  }

  /**
   * Update incentive details (only if PENDING)
   */
  async updateIncentive(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateIncentiveInput
  ) {
    const existing = await incentiveRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    if (existing.status !== "PENDING") {
      throw new ErrorResponse("Cannot update an already approved or processed incentive", statusCode.Bad_Request);
    }

    return incentiveRepo.update(id, input, userId);
  }

  /**
   * Approve incentive / penalty
   */
  async approveIncentive(id: string, organizationId: string, userId: string) {
    const existing = await incentiveRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    if (existing.status === "APPROVED" || existing.status === "PROCESSED_IN_PAYROLL") {
      throw new ErrorResponse("Incentive is already approved", statusCode.Bad_Request);
    }

    const reviewer = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    return incentiveRepo.updateStatus(id, "APPROVED", reviewer?.id || null);
  }

  /**
   * Reject incentive transaction
   */
  async rejectIncentive(
    id: string,
    organizationId: string,
    userId: string,
    remarks?: string | null
  ) {
    const existing = await incentiveRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    if (existing.status === "PROCESSED_IN_PAYROLL") {
      throw new ErrorResponse("Cannot reject an incentive that is already processed in payroll", statusCode.Bad_Request);
    }

    const reviewer = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    return incentiveRepo.updateStatus(id, "REJECTED", reviewer?.id || null, remarks);
  }

  /**
   * Cancel incentive transaction
   */
  async cancelIncentive(id: string, organizationId: string, userId: string) {
    const existing = await incentiveRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    if (existing.status === "PROCESSED_IN_PAYROLL") {
      throw new ErrorResponse("Cannot cancel an incentive that is already processed in payroll", statusCode.Bad_Request);
    }

    return incentiveRepo.updateStatus(id, "CANCELLED");
  }

  /**
   * Soft delete incentive
   */
  async deleteIncentive(id: string, organizationId: string) {
    const existing = await incentiveRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Incentive transaction not found", statusCode.Not_Found);
    }
    if (existing.status === "PROCESSED_IN_PAYROLL") {
      throw new ErrorResponse("Cannot delete an incentive that is already processed in payroll", statusCode.Bad_Request);
    }

    await incentiveRepo.delete(id);
    return { success: true, message: "Incentive transaction deleted successfully" };
  }
}

export const incentiveService = new IncentiveService();
