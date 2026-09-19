import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetIncentivesQueryInput,
  GetMyIncentivesQueryInput,
  UpdateIncentiveInput,
} from "../validators/incentive.validator.js";

export class IncentiveRepository {
  /**
   * Create an incentive / debit transaction
   */
  async create(params: {
    employeeId: string;
    type: "CREDIT" | "DEBIT";
    amount: number;
    currency?: string;
    reason: string;
    description?: string | null;
    remarks?: string | null;
    effectiveDate?: Date;
    createdById?: string | null;
    documents?: any;
  }) {
    return prisma.employeeIncentive.create({
      data: {
        employeeId: params.employeeId,
        type: params.type,
        amount: new Prisma.Decimal(params.amount),
        currency: params.currency || "INR",
        reason: params.reason,
        description: params.description || undefined,
        remarks: params.remarks || undefined,
        effectiveDate: params.effectiveDate || new Date(),
        createdById: params.createdById || undefined,
        documents: params.documents || undefined,
        status: "PENDING",
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
   * Find single incentive by ID with organization isolation
   */
  async findById(id: string, organizationId: string) {
    return prisma.employeeIncentive.findFirst({
      where: {
        id,
        isDeleted: false,
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
        payrollRecord: {
          select: {
            id: true,
            payrollPeriod: {
              select: { id: true, name: true, month: true, year: true },
            },
          },
        },
      },
    });
  }

  /**
   * List all incentives for organization (Admin / HR)
   */
  async findAll(organizationId: string, filters: GetIncentivesQueryInput) {
    const {
      page,
      limit,
      type,
      status,
      employeeId,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeIncentiveWhereInput = {
      isDeleted: false,
      employee: {
        organizationId,
        ...(employeeId && { id: employeeId }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      ...(type && { type }),
      ...(status && { status }),
      ...(startDate &&
        endDate && {
          effectiveDate: {
            gte: new Date(`${startDate}T00:00:00.000Z`),
            lte: new Date(`${endDate}T23:59:59.999Z`),
          },
        }),
    };

    const [incentives, total] = await Promise.all([
      prisma.employeeIncentive.findMany({
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
      prisma.employeeIncentive.count({ where }),
    ]);

    return {
      incentives,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List personal incentives for an employee
   */
  async findMyIncentives(
    employeeId: string,
    organizationId: string,
    filters: GetMyIncentivesQueryInput
  ) {
    const { page, limit, type, status, year } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeIncentiveWhereInput = {
      employeeId,
      isDeleted: false,
      employee: { organizationId },
      ...(type && { type }),
      ...(status && { status }),
      ...(year && {
        effectiveDate: {
          gte: new Date(`${year}-01-01T00:00:00.000Z`),
          lte: new Date(`${year}-12-31T23:59:59.999Z`),
        },
      }),
    };

    const [incentives, total, summaryAggregates] = await Promise.all([
      prisma.employeeIncentive.findMany({
        where,
        skip,
        take: limit,
        orderBy: { effectiveDate: "desc" },
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
      }),
      prisma.employeeIncentive.count({ where }),
      prisma.employeeIncentive.groupBy({
        by: ["type"],
        where: {
          employeeId,
          isDeleted: false,
          status: { in: ["APPROVED", "PROCESSED_IN_PAYROLL"] },
        },
        _sum: { amount: true },
      }),
    ]);

    let totalCredits = 0;
    let totalDebits = 0;
    for (const agg of summaryAggregates) {
      const sum = Number(agg._sum.amount || 0);
      if (agg.type === "CREDIT") totalCredits += sum;
      if (agg.type === "DEBIT") totalDebits += sum;
    }

    return {
      incentives,
      summary: {
        totalCredits,
        totalDebits,
        netIncentive: totalCredits - totalDebits,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get organization-wide aggregate metrics
   */
  async getSummaryMetrics(organizationId: string) {
    const aggregates = await prisma.employeeIncentive.groupBy({
      by: ["type", "status"],
      where: {
        isDeleted: false,
        employee: { organizationId },
      },
      _sum: { amount: true },
      _count: true,
    });

    let totalCredited = 0;
    let totalDebited = 0;
    let pendingCount = 0;

    for (const agg of aggregates) {
      const sum = Number(agg._sum.amount || 0);
      if (agg.status === "APPROVED" || agg.status === "PROCESSED_IN_PAYROLL") {
        if (agg.type === "CREDIT") totalCredited += sum;
        if (agg.type === "DEBIT") totalDebited += sum;
      }
      if (agg.status === "PENDING") {
        pendingCount += agg._count;
      }
    }

    return {
      totalCredited,
      totalDebited,
      netDisbursedIncentives: totalCredited - totalDebited,
      pendingApprovalCount: pendingCount,
    };
  }

  /**
   * Update incentive details (only if PENDING)
   */
  async update(id: string, data: UpdateIncentiveInput, updatedById?: string | null) {
    return prisma.employeeIncentive.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.amount != null && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.reason && { reason: data.reason }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.effectiveDate && { effectiveDate: new Date(`${data.effectiveDate}T00:00:00.000Z`) }),
        ...(updatedById && { updatedById }),
      },
      include: {
        employee: true,
      },
    });
  }

  /**
   * Update status (Approve / Reject / Cancel)
   */
  async updateStatus(
    id: string,
    status: "APPROVED" | "REJECTED" | "CANCELLED",
    approvedById?: string | null,
    remarks?: string | null
  ) {
    return prisma.employeeIncentive.update({
      where: { id },
      data: {
        status,
        ...(approvedById && { approvedById }),
        actionDate: new Date(),
        ...(remarks !== undefined && { remarks }),
      },
      include: {
        employee: true,
        approvedBy: true,
      },
    });
  }

  /**
   * Soft delete incentive
   */
  async delete(id: string) {
    return prisma.employeeIncentive.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const incentiveRepo = new IncentiveRepository();
