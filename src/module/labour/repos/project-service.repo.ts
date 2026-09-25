import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateProjectServiceInput,
  UpdateProjectServiceInput,
  GetProjectServicesQuery,
} from "../validators/project-service.validator.js";

/**
 * Project Service Repository
 * Handles Prisma DB operations for Project Services and workforce allocations.
 */
export class ProjectServiceRepository {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Generate sequential service code per organization: SRV-YYYY-NNNN
   */
  async generateServiceCode(organizationId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `SRV-${currentYear}-`;

    const lastRecord = await prisma.projectService.findFirst({
      where: {
        organizationId,
        serviceCode: { startsWith: prefix },
      },
      orderBy: { serviceCode: "desc" },
      select: { serviceCode: true },
    });

    let nextSeq = 1;
    if (lastRecord?.serviceCode) {
      const parts = lastRecord.serviceCode.split("-");
      const lastSeq = parseInt(parts[2] || "0", 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Create a new Project Service
   */
  async create(
    data: CreateProjectServiceInput & { serviceCode: string },
    organizationId: string
  ) {
    return prisma.projectService.create({
      data: {
        organizationId,
        projectId: data.projectId,
        serviceCode: data.serviceCode,
        title: data.title,
        category: data.category,
        description: data.description,
        scopeOfWork: data.scopeOfWork,
        location: data.location,
        status: data.status || "PLANNED",
        priority: data.priority || "MEDIUM",
        startDate: data.startDate,
        endDate: data.endDate,
        estimatedDurationDays: data.estimatedDurationDays || 1,
        estimatedBudget: data.estimatedBudget || 0,
        supervisorId: data.supervisorId,
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            status: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        _count: {
          select: {
            labourBookings: true,
          },
        },
      },
    });
  }

  /**
   * Find a single Project Service by ID with full nested workforce details
   */
  async findById(id: string, organizationId: string) {
    return prisma.projectService.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            status: true,
            currentStage: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workPhone: true,
          },
        },
        labourBookings: {
          where: { isDeleted: false },
          include: {
            labour: {
              select: {
                id: true,
                name: true,
                phone: true,
                trade: true,
                skillLevel: true,
                photoUrl: true,
                dailyRate: true,
              },
            },
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                paymentDate: true,
                paymentMethod: true,
              },
            },
            ratings: {
              select: {
                id: true,
                rating: true,
                reviewerName: true,
                reviewerRole: true,
              },
            },
            disputes: {
              select: {
                id: true,
                disputeType: true,
                status: true,
                amountInDispute: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            labourBookings: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated Project Services with multi-criteria filters
   */
  async findAll(query: GetProjectServicesQuery, organizationId: string) {
    const {
      page = 1,
      limit = 10,
      projectId,
      category,
      status,
      priority,
      supervisorId,
      search,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectServiceWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (projectId) where.projectId = projectId;
    if (category) where.category = category;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (supervisorId) where.supervisorId = supervisorId;

    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = startDate;
      if (endDate) where.startDate.lte = endDate;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { serviceCode: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { scopeOfWork: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { project: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, services] = await Promise.all([
      prisma.projectService.count({ where }),
      prisma.projectService.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              status: true,
            },
          },
          supervisor: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          _count: {
            select: {
              labourBookings: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      services,
    };
  }

  /**
   * Update a Project Service
   */
  async update(
    id: string,
    data: UpdateProjectServiceInput,
    organizationId: string
  ) {
    return prisma.projectService.update({
      where: { id, organizationId },
      data: {
        ...(data.projectId && { projectId: data.projectId }),
        ...(data.title && { title: data.title }),
        ...(data.category && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.scopeOfWork !== undefined && { scopeOfWork: data.scopeOfWork }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.estimatedDurationDays !== undefined && {
          estimatedDurationDays: data.estimatedDurationDays,
        }),
        ...(data.estimatedBudget !== undefined && {
          estimatedBudget: data.estimatedBudget,
        }),
        ...(data.supervisorId !== undefined && {
          supervisorId: data.supervisorId,
        }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: this.formatJsonValue(data.additionalInformation),
        }),
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            status: true,
          },
        },
        supervisor: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        _count: {
          select: {
            labourBookings: true,
          },
        },
      },
    });
  }

  /**
   * Update status of a Project Service
   */
  async updateStatus(id: string, status: string, organizationId: string) {
    return prisma.projectService.update({
      where: { id, organizationId },
      data: { status },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a Project Service
   */
  async delete(id: string, organizationId: string) {
    return prisma.projectService.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Recalculate financial rollups (actualCost & totalPaid) from child LabourBookings
   */
  async recalculateRollup(projectServiceId: string) {
    const bookings = await prisma.labourBooking.findMany({
      where: {
        projectServiceId,
        isDeleted: false,
      },
      select: {
        totalBudget: true,
        totalPaid: true,
      },
    });

    const actualCost = bookings.reduce(
      (sum, b) => sum + Number(b.totalBudget || 0),
      0
    );
    const totalPaid = bookings.reduce(
      (sum, b) => sum + Number(b.totalPaid || 0),
      0
    );

    return prisma.projectService.update({
      where: { id: projectServiceId },
      data: {
        actualCost,
        totalPaid,
      },
    });
  }
}

export const projectServiceRepo = new ProjectServiceRepository();
