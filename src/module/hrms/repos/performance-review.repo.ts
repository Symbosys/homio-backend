import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreatePerformanceReviewInput,
  GetPerformanceReviewsQueryInput,
  UpdatePerformanceReviewInput,
} from "../validators/performance-review.validator.js";

export class PerformanceReviewRepository {
  /**
   * Create a performance review
   */
  async create(params: {
    employeeId: string;
    reviewerId?: string | null;
    reviewPeriod: string;
    reviewType: "QUARTERLY" | "ANNUAL" | "PROBATION" | "SPECIAL";
    reviewDate?: Date;
    overallScore: number;
    kpiScores: Record<string, number>;
    selfReviewComments?: string | null;
    reviewerComments?: string | null;
    recommendation: string;
    recommendedHike?: number | null;
    status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  }) {
    return prisma.performanceReview.create({
      data: {
        employeeId: params.employeeId,
        reviewerId: params.reviewerId || undefined,
        reviewPeriod: params.reviewPeriod,
        reviewType: params.reviewType,
        reviewDate: params.reviewDate || new Date(),
        overallScore: new Prisma.Decimal(params.overallScore),
        kpiScores: params.kpiScores as Prisma.InputJsonValue,
        selfReviewComments: params.selfReviewComments || undefined,
        reviewerComments: params.reviewerComments || undefined,
        recommendation: params.recommendation,
        recommendedHike: params.recommendedHike != null ? new Prisma.Decimal(params.recommendedHike) : undefined,
        status: params.status,
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
            departmentAssignments: {
              include: { department: true, team: true },
            },
          },
        },
        reviewer: {
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
   * Find performance review by ID with organization verification through employee
   */
  async findById(id: string, organizationId: string) {
    return prisma.performanceReview.findFirst({
      where: {
        id,
        employee: {
          organizationId,
        },
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
            departmentAssignments: {
              include: { department: true, team: true },
            },
          },
        },
        reviewer: {
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
   * List all performance reviews for an organization
   */
  async findAll(organizationId: string, filters: GetPerformanceReviewsQueryInput) {
    const {
      page,
      limit,
      employeeId,
      reviewerId,
      reviewPeriod,
      reviewType,
      status,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.PerformanceReviewWhereInput = {
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
      ...(reviewerId && { reviewerId }),
      ...(reviewPeriod && { reviewPeriod: { contains: reviewPeriod, mode: "insensitive" } }),
      ...(reviewType && { reviewType }),
      ...(status && { status }),
    };

    const [reviews, total] = await Promise.all([
      prisma.performanceReview.findMany({
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
          reviewer: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
        },
      }),
      prisma.performanceReview.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find personal reviews for an employee
   */
  async findByEmployeeId(employeeId: string, organizationId: string) {
    return prisma.performanceReview.findMany({
      where: {
        employeeId,
        employee: { organizationId },
      },
      orderBy: { reviewDate: "desc" },
      include: {
        reviewer: {
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
   * Update performance review
   */
  async update(id: string, data: UpdatePerformanceReviewInput) {
    return prisma.performanceReview.update({
      where: { id },
      data: {
        ...(data.reviewPeriod && { reviewPeriod: data.reviewPeriod }),
        ...(data.reviewType && { reviewType: data.reviewType }),
        ...(data.reviewDate && { reviewDate: new Date(`${data.reviewDate}T00:00:00.000Z`) }),
        ...(data.overallScore != null && { overallScore: new Prisma.Decimal(data.overallScore) }),
        ...(data.kpiScores && { kpiScores: data.kpiScores as Prisma.InputJsonValue }),
        ...(data.selfReviewComments !== undefined && { selfReviewComments: data.selfReviewComments }),
        ...(data.reviewerComments !== undefined && { reviewerComments: data.reviewerComments }),
        ...(data.recommendation && { recommendation: data.recommendation }),
        ...(data.recommendedHike !== undefined && {
          recommendedHike: data.recommendedHike != null ? new Prisma.Decimal(data.recommendedHike) : null,
        }),
        ...(data.status && { status: data.status }),
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        reviewer: {
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
   * Delete performance review
   */
  async delete(id: string) {
    return prisma.performanceReview.delete({
      where: { id },
    });
  }
}

export const performanceReviewRepo = new PerformanceReviewRepository();
