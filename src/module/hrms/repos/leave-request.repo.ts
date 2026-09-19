import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  ApplyLeaveInput,
  GetLeaveRequestsQueryInput,
  GetMyLeavesQueryInput,
} from "../validators/leave-request.validator.js";

export class LeaveRequestRepository {
  /**
   * Check for existing overlapping pending or approved leave requests
   */
  async checkOverlap(
    employeeId: string,
    organizationId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string
  ) {
    return prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        organizationId,
        status: { in: ["PENDING", "APPROVED"] },
        ...(excludeId && { id: { not: excludeId } }),
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
      include: { leaveType: true },
    });
  }

  /**
   * Create leave request application
   */
  async create(params: {
    organizationId: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    totalDays: number;
    isHalfDay: boolean;
    halfDaySession?: "FIRST_HALF" | "SECOND_HALF" | null;
    reason: string;
    documents?: any;
  }) {
    return prisma.leaveRequest.create({
      data: {
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        leaveTypeId: params.leaveTypeId,
        startDate: params.startDate,
        endDate: params.endDate,
        totalDays: new Prisma.Decimal(params.totalDays),
        isHalfDay: params.isHalfDay,
        halfDaySession: params.halfDaySession,
        reason: params.reason,
        documents: params.documents || undefined,
        status: "PENDING",
      },
      include: {
        leaveType: true,
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
   * Find leave request by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.leaveRequest.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        leaveType: true,
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
   * List all leave requests for organization (Admin / HR view)
   */
  async findAll(organizationId: string, filters: GetLeaveRequestsQueryInput) {
    const {
      page,
      limit,
      status,
      leaveTypeId,
      departmentId,
      employeeId,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {
      organizationId,
      ...(status && { status }),
      ...(leaveTypeId && { leaveTypeId }),
      ...(employeeId && { employeeId }),
      ...(startDate &&
        endDate && {
          startDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
          endDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
        }),
      ...(departmentId && {
        employee: {
          departmentAssignments: {
            some: { departmentId },
          },
        },
      }),
      ...(search && {
        OR: [
          { employee: { firstName: { contains: search, mode: "insensitive" } } },
          { employee: { lastName: { contains: search, mode: "insensitive" } } },
          { employee: { employeeCode: { contains: search, mode: "insensitive" } } },
          { reason: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          leaveType: {
            select: { id: true, name: true, code: true, isPaid: true },
          },
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
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      leaveRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List personal leave applications for employee
   */
  async findMyLeaves(
    employeeId: string,
    organizationId: string,
    filters: GetMyLeavesQueryInput
  ) {
    const { page, limit, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveRequestWhereInput = {
      employeeId,
      organizationId,
      ...(status && { status }),
      ...(startDate &&
        endDate && {
          startDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
          endDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
        }),
    };

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          leaveType: true,
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
      prisma.leaveRequest.count({ where }),
    ]);

    return {
      leaveRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update leave request status (Approve / Reject / Cancel)
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: "APPROVED" | "REJECTED" | "CANCELLED",
    approvedById?: string | null,
    adminRemarks?: string | null
  ) {
    return prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: approvedById || undefined,
        actionDate: new Date(),
        ...(adminRemarks && { adminRemarks }),
      },
      include: {
        leaveType: true,
        employee: true,
      },
    });
  }

  /**
   * Calculate real-time leave balance across all active leave types for employee in the current year
   */
  async getEmployeeLeaveBalance(employeeId: string, organizationId: string, year: number) {
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    const [leaveTypes, requests] = await Promise.all([
      prisma.leaveType.findMany({
        where: {
          organizationId,
          isDeleted: false,
          status: "ACTIVE",
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId,
          organizationId,
          status: { in: ["APPROVED", "PENDING"] },
          startDate: { gte: startOfYear, lte: endOfYear },
        },
      }),
    ]);

    return leaveTypes.map((lt) => {
      const allowed = Number(lt.daysAllowedPerYear);
      let approvedDays = 0;
      let pendingDays = 0;

      for (const req of requests) {
        if (req.leaveTypeId === lt.id) {
          const days = Number(req.totalDays);
          if (req.status === "APPROVED") {
            approvedDays += days;
          } else if (req.status === "PENDING") {
            pendingDays += days;
          }
        }
      }

      const balance = Math.max(0, allowed - approvedDays);

      return {
        leaveTypeId: lt.id,
        name: lt.name,
        code: lt.code,
        isPaid: lt.isPaid,
        allowedDays: allowed,
        approvedDays,
        pendingDays,
        remainingBalance: balance,
      };
    });
  }
}

export const leaveRequestRepo = new LeaveRequestRepository();
