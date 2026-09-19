import { noticePeriodRepo } from "../repos/notice-period.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  ApplyNoticePeriodInput,
  GetNoticePeriodsQueryInput,
  ApproveNoticePeriodInput,
  RejectNoticePeriodInput,
  UpdateNoticeBuyoutInput,
  UpdateHandoverInput,
  CompleteSettlementInput,
} from "../validators/notice-period.validator.js";

export class NoticePeriodService {
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
   * Helper: Upload resignation letters / clearance documents
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
          folder: `homio/organizations/${organizationId}/hrms/offboarding/documents`,
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
   * Employee applies for resignation and initiates notice period
   */
  async applyNoticePeriod(
    organizationId: string,
    userId: string,
    input: ApplyNoticePeriodInput,
    files?: Express.Multer.File[]
  ) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);

    // Check if there is already an active resignation in progress
    const active = await noticePeriodRepo.findActiveByEmployeeId(employee.id);
    if (active) {
      throw new ErrorResponse(
        "You already have an active resignation or notice period under review",
        statusCode.Conflict
      );
    }

    const uploadedDocs = await this.uploadDocuments(files, organizationId);

    const noticeStartDate = new Date(`${input.noticeStartDate}T00:00:00.000Z`);
    const expectedLastWorkingDay = new Date(`${input.expectedLastWorkingDay}T00:00:00.000Z`);

    if (expectedLastWorkingDay < noticeStartDate) {
      throw new ErrorResponse("Expected last working day cannot be before notice start date", statusCode.Bad_Request);
    }

    return noticePeriodRepo.create({
      employeeId: employee.id,
      noticeStartDate,
      noticeDays: input.noticeDays,
      expectedLastWorkingDay,
      reason: input.reason,
      description: input.description,
      createdById: userId,
      documents: uploadedDocs.length > 0 ? uploadedDocs : undefined,
    });
  }

  /**
   * Get current employee's notice period status and history
   */
  async getMyNoticePeriods(organizationId: string, userId: string) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return noticePeriodRepo.findMyNoticePeriods(employee.id, organizationId);
  }

  /**
   * List all notice periods for organization (Admin / HR)
   */
  async getAllNoticePeriods(organizationId: string, filters: GetNoticePeriodsQueryInput) {
    return noticePeriodRepo.findAll(organizationId, filters);
  }

  /**
   * Get single notice period details by ID
   */
  async getNoticePeriodById(id: string, organizationId: string) {
    const noticePeriod = await noticePeriodRepo.findById(id, organizationId);
    if (!noticePeriod) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }
    return noticePeriod;
  }

  /**
   * Approve resignation & notice period
   */
  async approveNoticePeriod(
    id: string,
    organizationId: string,
    userId: string,
    input: ApproveNoticePeriodInput
  ) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }
    if (existing.status === "APPROVED" || existing.status === "COMPLETED") {
      throw new ErrorResponse("Notice period is already approved or completed", statusCode.Bad_Request);
    }

    const reviewer = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    const expectedLastWorkingDay = input.expectedLastWorkingDay
      ? new Date(`${input.expectedLastWorkingDay}T00:00:00.000Z`)
      : null;

    return noticePeriodRepo.updateStatus(
      id,
      "APPROVED",
      reviewer?.id || null,
      expectedLastWorkingDay,
      input.adminRemarks
    );
  }

  /**
   * Reject resignation request
   */
  async rejectNoticePeriod(
    id: string,
    organizationId: string,
    userId: string,
    input: RejectNoticePeriodInput
  ) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }
    if (existing.status === "COMPLETED") {
      throw new ErrorResponse("Cannot reject an already completed notice period", statusCode.Bad_Request);
    }

    const reviewer = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    return noticePeriodRepo.updateStatus(
      id,
      "REJECTED",
      reviewer?.id || null,
      null,
      input.adminRemarks
    );
  }

  /**
   * Withdraw resignation request
   */
  async withdrawNoticePeriod(id: string, organizationId: string, userId: string) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }
    if (existing.status === "COMPLETED") {
      throw new ErrorResponse("Cannot withdraw an already settled notice period", statusCode.Bad_Request);
    }

    return noticePeriodRepo.updateStatus(id, "WITHDRAWN");
  }

  /**
   * Configure / Approve Notice Buyout
   */
  async updateNoticeBuyout(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateNoticeBuyoutInput
  ) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }

    const actualLastWorkingDay = input.actualLastWorkingDay
      ? new Date(`${input.actualLastWorkingDay}T00:00:00.000Z`)
      : null;

    return noticePeriodRepo.updateBuyout(id, {
      buyoutOption: input.buyoutOption,
      buyoutDays: input.buyoutDays,
      buyoutAmount: input.buyoutAmount,
      actualLastWorkingDay,
      adminRemarks: input.adminRemarks,
      updatedById: userId,
    });
  }

  /**
   * Update Handover & Clearance Progress
   */
  async updateHandover(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateHandoverInput
  ) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }

    return noticePeriodRepo.updateHandover(id, {
      handoverStatus: input.handoverStatus,
      exitInterviewNotes: input.exitInterviewNotes,
      updatedById: userId,
    });
  }

  /**
   * Complete Full & Final Settlement and Terminate Employee Profile
   */
  async completeSettlement(
    id: string,
    organizationId: string,
    userId: string,
    input: CompleteSettlementInput
  ) {
    const existing = await noticePeriodRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Notice period record not found", statusCode.Not_Found);
    }
    if (existing.status === "COMPLETED" && existing.isSettled) {
      throw new ErrorResponse("Settlement is already marked as completed", statusCode.Bad_Request);
    }

    const actualLastWorkingDay = new Date(`${input.actualLastWorkingDay}T00:00:00.000Z`);

    const result = await noticePeriodRepo.completeSettlementAndTerminateEmployee(
      id,
      existing.employeeId,
      actualLastWorkingDay,
      input.adminRemarks,
      userId
    );

    return {
      noticePeriod: result,
      message: "Full & Final settlement completed and employee employmentStatus transitioned to TERMINATED",
    };
  }
}

export const noticePeriodService = new NoticePeriodService();
