import { leaveRequestRepo } from "../repos/leave-request.repo.js";
import { leaveTypeRepo } from "../repos/leave-type.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  ApplyLeaveInput,
  GetLeaveRequestsQueryInput,
  GetMyLeavesQueryInput,
} from "../validators/leave-request.validator.js";

export class LeaveRequestService {
  /**
   * Helper: Resolve employee for user
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
   * Helper: Upload supporting proof/medical certificate
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
          folder: `homio/organizations/${organizationId}/hrms/leaves/proofs`,
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
   * Apply for leave
   */
  async applyLeave(
    organizationId: string,
    userId: string,
    input: ApplyLeaveInput,
    files?: Express.Multer.File[]
  ) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);

    // 1. Verify leave type exists
    const leaveType = await leaveTypeRepo.findById(input.leaveTypeId, organizationId);
    if (!leaveType || leaveType.status !== "ACTIVE") {
      throw new ErrorResponse("Selected leave type is not active or valid", statusCode.Bad_Request);
    }

    const startDate = new Date(`${input.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${input.endDate}T00:00:00.000Z`);

    if (startDate > endDate) {
      throw new ErrorResponse("End date cannot be earlier than start date", statusCode.Bad_Request);
    }

    // 2. Calculate total days
    let totalDays = 1.0;
    if (input.isHalfDay) {
      if (input.startDate !== input.endDate) {
        throw new ErrorResponse("Half-day leave can only be applied for a single date", statusCode.Bad_Request);
      }
      totalDays = 0.5;
    } else {
      const diffTime = endDate.getTime() - startDate.getTime();
      totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }

    // 3. Check for overlapping leave requests
    const overlap = await leaveRequestRepo.checkOverlap(employee.id, organizationId, startDate, endDate);
    if (overlap) {
      throw new ErrorResponse(
        `You already have an active leave request (${overlap.status}) for this period (${overlap.startDate.toISOString().split("T")[0]} to ${overlap.endDate.toISOString().split("T")[0]})`,
        statusCode.Conflict
      );
    }

    // 4. Validate leave balance
    const currentYear = startDate.getFullYear();
    const balances = await leaveRequestRepo.getEmployeeLeaveBalance(employee.id, organizationId, currentYear);
    const balanceForType = balances.find((b) => b.leaveTypeId === input.leaveTypeId);

    if (balanceForType && totalDays > balanceForType.remainingBalance) {
      throw new ErrorResponse(
        `Insufficient leave balance for ${leaveType.name}. Available: ${balanceForType.remainingBalance} days, Requested: ${totalDays} days`,
        statusCode.Bad_Request
      );
    }

    // 5. Upload supporting documents
    const uploadedDocs = await this.uploadDocuments(files, organizationId);

    // 6. Create leave request
    return leaveRequestRepo.create({
      organizationId,
      employeeId: employee.id,
      leaveTypeId: input.leaveTypeId,
      startDate,
      endDate,
      totalDays,
      isHalfDay: !!input.isHalfDay,
      halfDaySession: input.halfDaySession || null,
      reason: input.reason,
      documents: uploadedDocs.length > 0 ? uploadedDocs : undefined,
    });
  }

  /**
   * Get employee's personal leave applications
   */
  async getMyLeaves(organizationId: string, userId: string, filters: GetMyLeavesQueryInput) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return leaveRequestRepo.findMyLeaves(employee.id, organizationId, filters);
  }

  /**
   * Get employee's real-time leave balance
   */
  async getMyLeaveBalance(organizationId: string, userId: string) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    const year = new Date().getFullYear();
    return leaveRequestRepo.getEmployeeLeaveBalance(employee.id, organizationId, year);
  }

  /**
   * Get all leave requests (Admin / HR view)
   */
  async getAllLeaveRequests(organizationId: string, filters: GetLeaveRequestsQueryInput) {
    return leaveRequestRepo.findAll(organizationId, filters);
  }

  /**
   * Get single leave request by ID
   */
  async getLeaveRequestById(id: string, organizationId: string) {
    const request = await leaveRequestRepo.findById(id, organizationId);
    if (!request) {
      throw new ErrorResponse("Leave request not found", statusCode.Not_Found);
    }
    return request;
  }

  /**
   * Approve leave request & sync daily attendance
   */
  async approveLeave(
    id: string,
    organizationId: string,
    userId: string,
    adminRemarks?: string
  ) {
    const request = await this.getLeaveRequestById(id, organizationId);

    if (request.status !== "PENDING") {
      throw new ErrorResponse(
        `Cannot approve leave request with status '${request.status}'`,
        statusCode.Bad_Request
      );
    }

    const approverEmployee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    const updated = await leaveRequestRepo.updateStatus(
      id,
      organizationId,
      "APPROVED",
      approverEmployee?.id || null,
      adminRemarks
    );

    // Sync with Attendance table: mark each day as ON_LEAVE
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const attendanceStatus = request.isHalfDay ? "HALF_DAY" : "ON_LEAVE";

    const cur = new Date(start);
    while (cur <= end) {
      const attendanceDate = new Date(cur);
      await prisma.attendance.upsert({
        where: {
          organizationId_employeeId_attendanceDate: {
            organizationId,
            employeeId: request.employeeId,
            attendanceDate,
          },
        },
        create: {
          organizationId,
          employeeId: request.employeeId,
          attendanceDate,
          status: attendanceStatus,
          remarks: `Approved Leave: ${request.leaveType.name}${adminRemarks ? ` - ${adminRemarks}` : ""}`,
        },
        update: {
          status: attendanceStatus,
          remarks: `Approved Leave: ${request.leaveType.name}${adminRemarks ? ` - ${adminRemarks}` : ""}`,
        },
      });
      cur.setDate(cur.getDate() + 1);
    }

    return updated;
  }

  /**
   * Reject leave request
   */
  async rejectLeave(
    id: string,
    organizationId: string,
    userId: string,
    adminRemarks: string
  ) {
    const request = await this.getLeaveRequestById(id, organizationId);

    if (request.status !== "PENDING") {
      throw new ErrorResponse(
        `Cannot reject leave request with status '${request.status}'`,
        statusCode.Bad_Request
      );
    }

    const approverEmployee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });

    return leaveRequestRepo.updateStatus(
      id,
      organizationId,
      "REJECTED",
      approverEmployee?.id || null,
      adminRemarks
    );
  }

  /**
   * Cancel leave request (by employee or admin)
   */
  async cancelLeave(id: string, organizationId: string, userId: string) {
    const request = await this.getLeaveRequestById(id, organizationId);

    if (request.status === "REJECTED" || request.status === "CANCELLED") {
      throw new ErrorResponse(
        `Leave request is already ${request.status.toLowerCase()}`,
        statusCode.Bad_Request
      );
    }

    return leaveRequestRepo.updateStatus(id, organizationId, "CANCELLED");
  }

  /**
   * Get employee leave balance (Admin view)
   */
  async getEmployeeLeaveBalance(employeeId: string, organizationId: string) {
    const year = new Date().getFullYear();
    return leaveRequestRepo.getEmployeeLeaveBalance(employeeId, organizationId, year);
  }
}

export const leaveRequestService = new LeaveRequestService();
