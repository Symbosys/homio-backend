import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetNoticePeriodsQueryInput,
  ApplyNoticePeriodInput,
} from "../validators/notice-period.validator.js";

export class NoticePeriodRepository {
  /**
   * Create resignation / notice period application
   */
  async create(params: {
    employeeId: string;
    noticeStartDate: Date;
    noticeDays: number;
    expectedLastWorkingDay: Date;
    reason: string;
    description?: string | null;
    createdById?: string | null;
    documents?: any;
  }) {
    return prisma.noticePeriod.create({
      data: {
        employeeId: params.employeeId,
        noticeStartDate: params.noticeStartDate,
        noticeDays: params.noticeDays,
        expectedLastWorkingDay: params.expectedLastWorkingDay,
        reason: params.reason,
        description: params.description || undefined,
        createdById: params.createdById || undefined,
        documents: params.documents || undefined,
        status: "SUBMITTED",
        handoverStatus: "PENDING",
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find active notice period for an employee (Prevent multiple concurrent resignations)
   */
  async findActiveByEmployeeId(employeeId: string) {
    return prisma.noticePeriod.findFirst({
      where: {
        employeeId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find single notice period by ID with tenant isolation
   */
  async findById(id: string, organizationId: string) {
    return prisma.noticePeriod.findFirst({
      where: {
        id,
        employee: { organizationId },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            workEmail: true,
            workPhone: true,
            joiningDate: true,
            departmentAssignments: {
              include: { department: true, team: true },
            },
          },
        },
        approvedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * List all notice periods for organization (Admin / HR view)
   */
  async findAll(organizationId: string, filters: GetNoticePeriodsQueryInput) {
    const {
      page,
      limit,
      status,
      handoverStatus,
      isSettled,
      employeeId,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.NoticePeriodWhereInput = {
      employee: {
        organizationId,
        ...(employeeId && { id: employeeId }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
            { designation: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      ...(status && { status }),
      ...(handoverStatus && { handoverStatus }),
      ...(isSettled !== undefined && { isSettled }),
    };

    const [noticePeriods, total] = await Promise.all([
      prisma.noticePeriod.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              avatarUrl: true,
              departmentAssignments: {
                include: { department: true },
              },
            },
          },
          approvedBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.noticePeriod.count({ where }),
    ]);

    return {
      noticePeriods,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find notice period history for an employee
   */
  async findMyNoticePeriods(employeeId: string, organizationId: string) {
    return prisma.noticePeriod.findMany({
      where: {
        employeeId,
        employee: { organizationId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        approvedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Update status (Approve / Reject / Withdraw)
   */
  async updateStatus(
    id: string,
    status: "APPROVED" | "REJECTED" | "WITHDRAWN",
    approvedById?: string | null,
    expectedLastWorkingDay?: Date | null,
    adminRemarks?: string | null
  ) {
    return prisma.noticePeriod.update({
      where: { id },
      data: {
        status,
        ...(approvedById && { approvedById }),
        actionDate: new Date(),
        ...(expectedLastWorkingDay && { expectedLastWorkingDay }),
        ...(adminRemarks !== undefined && { adminRemarks }),
      },
      include: {
        employee: true,
        approvedBy: true,
      },
    });
  }

  /**
   * Configure / Approve Notice Buyout
   */
  async updateBuyout(
    id: string,
    params: {
      buyoutOption: boolean;
      buyoutDays: number;
      buyoutAmount: number;
      actualLastWorkingDay?: Date | null;
      adminRemarks?: string | null;
      updatedById?: string | null;
    }
  ) {
    return prisma.noticePeriod.update({
      where: { id },
      data: {
        buyoutOption: params.buyoutOption,
        buyoutDays: params.buyoutDays,
        buyoutAmount: new Prisma.Decimal(params.buyoutAmount),
        ...(params.actualLastWorkingDay && { actualLastWorkingDay: params.actualLastWorkingDay }),
        ...(params.adminRemarks !== undefined && { adminRemarks: params.adminRemarks }),
        ...(params.updatedById && { updatedById: params.updatedById }),
      },
      include: {
        employee: true,
      },
    });
  }

  /**
   * Update Handover & Clearance Progress
   */
  async updateHandover(
    id: string,
    params: {
      handoverStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
      exitInterviewNotes?: string | null;
      updatedById?: string | null;
    }
  ) {
    return prisma.noticePeriod.update({
      where: { id },
      data: {
        handoverStatus: params.handoverStatus,
        ...(params.exitInterviewNotes !== undefined && {
          exitInterviewNotes: params.exitInterviewNotes,
        }),
        ...(params.updatedById && { updatedById: params.updatedById }),
      },
      include: {
        employee: true,
      },
    });
  }

  /**
   * Complete Full & Final Settlement and Terminate Employee Profile (Transactional)
   */
  async completeSettlementAndTerminateEmployee(
    id: string,
    employeeId: string,
    actualLastWorkingDay: Date,
    adminRemarks?: string | null,
    updatedById?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Mark Notice Period as COMPLETED and settled
      const noticePeriod = await tx.noticePeriod.update({
        where: { id },
        data: {
          status: "COMPLETED",
          isSettled: true,
          actualLastWorkingDay,
          ...(adminRemarks !== undefined && { adminRemarks }),
          ...(updatedById && { updatedById }),
        },
      });

      // 2. Automatically update employee's employmentStatus to TERMINATED and assign relieving & termination dates
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          employmentStatus: "TERMINATED",
          relievingDate: actualLastWorkingDay,
          terminationDate: actualLastWorkingDay,
          ...(adminRemarks && { terminationReason: adminRemarks }),
        },
      });

      return noticePeriod;
    });
  }
}

export const noticePeriodRepo = new NoticePeriodRepository();
