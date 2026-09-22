import { prisma } from "../../../lib/prisma.js";
import { Prisma, type ImageType, ServiceRequestStatus } from "../../../types/types.js";
import type {
  CreateServiceRequestInput,
  UpdateServiceRequestInput,
  AssignServiceRequestInput,
  ResolveServiceRequestInput,
  ReopenServiceRequestInput,
  GetServiceRequestsQueryInput,
} from "../validators/service-request.validator.js";

export class ServiceRequestRepository {
  /**
   * Auto-generates sequential ticket code (SR-YYYY-NNNN)
   */
  async generateNextRequestNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SR-${year}-`;

    const latest = await prisma.afterSalesServiceRequest.findFirst({
      where: {
        project: { organizationId },
        requestNumber: { startsWith: prefix },
      },
      orderBy: { requestNumber: "desc" },
      select: { requestNumber: true },
    });

    let nextSeq = 1;
    if (latest?.requestNumber) {
      const parts = latest.requestNumber.split("-");
      if (parts[2]) {
        const currentSeq = parseInt(parts[2], 10);
        if (!isNaN(currentSeq)) {
          nextSeq = currentSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Create service request ticket
   */
  async create(
    organizationId: string,
    data: CreateServiceRequestInput,
    attachments?: ImageType[]
  ) {
    const requestNumber = await this.generateNextRequestNumber(organizationId);

    return prisma.afterSalesServiceRequest.create({
      data: {
        projectId: data.projectId,
        categoryId: data.categoryId,
        warrantyId: data.warrantyId,
        requestNumber,
        priority: data.priority || "MEDIUM",
        status: data.assignedToId ? "ASSIGNED" : "OPEN",
        subject: data.subject,
        description: data.description,
        areaRoom: data.areaRoom,
        specificLocation: data.specificLocation,
        preferredServiceDate: data.preferredServiceDate ? new Date(data.preferredServiceDate) : null,
        preferredTimeSlot: data.preferredTimeSlot,
        customerAvailabilityNotes: data.customerAvailabilityNotes,
        assignedToId: data.assignedToId,
        assignedAt: data.assignedToId ? new Date() : null,
        isWarrantyCovered: data.isWarrantyCovered ?? false,
        billingStatus: data.billingStatus || "FREE_UNDER_WARRANTY",
        estimatedCost: data.estimatedCost !== undefined && data.estimatedCost !== null ? new Prisma.Decimal(data.estimatedCost) : null,
        finalCost: data.finalCost !== undefined && data.finalCost !== null ? new Prisma.Decimal(data.finalCost) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        internalNotes: data.internalNotes,
        additionalInformation: data.additionalInformation !== undefined ? (data.additionalInformation as Prisma.InputJsonValue) : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
  }

  /**
   * Find request by ID with full details
   */
  async findById(organizationId: string, id: string) {
    return prisma.afterSalesServiceRequest.findFirst({
      where: {
        id,
        project: { organizationId },
        isDeleted: false,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        category: true,
        warranty: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, workPhone: true, workEmail: true },
        },
        visits: {
          where: { isDeleted: false },
          orderBy: { scheduledDate: "desc" },
          include: {
            assignedEmployee: {
              select: { id: true, firstName: true, lastName: true, employeeCode: true },
            },
          },
        },
        feedback: true,
        warrantyClaim: true,
      },
    });
  }

  /**
   * List paginated service requests
   */
  async list(organizationId: string, query: GetServiceRequestsQueryInput) {
    const {
      projectId,
      categoryId,
      warrantyId,
      assignedToId,
      priority,
      status,
      billingStatus,
      search,
      isOverdue,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const now = new Date();
    const where: Prisma.AfterSalesServiceRequestWhereInput = {
      project: { organizationId },
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(categoryId && { categoryId }),
      ...(warrantyId && { warrantyId }),
      ...(assignedToId && { assignedToId }),
      ...(priority && { priority }),
      ...(status && { status }),
      ...(billingStatus && { billingStatus }),
      ...(isOverdue && {
        dueDate: { lt: now },
        status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
      }),
      ...(startDate && { createdAt: { gte: new Date(startDate) } }),
      ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { requestNumber: { contains: search, mode: "insensitive" } },
          { subject: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { areaRoom: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.afterSalesServiceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: { id: true, name: true, projectCode: true },
          },
          category: {
            select: { id: true, name: true, icon: true, color: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
          _count: {
            select: { visits: true },
          },
        },
      }),
      prisma.afterSalesServiceRequest.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Partial update request details & attachments
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateServiceRequestInput,
    attachments?: ImageType[]
  ) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.warrantyId !== undefined && { warrantyId: data.warrantyId }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.areaRoom !== undefined && { areaRoom: data.areaRoom }),
        ...(data.specificLocation !== undefined && { specificLocation: data.specificLocation }),
        ...(data.preferredServiceDate !== undefined && {
          preferredServiceDate: data.preferredServiceDate ? new Date(data.preferredServiceDate) : null,
        }),
        ...(data.preferredTimeSlot !== undefined && { preferredTimeSlot: data.preferredTimeSlot }),
        ...(data.customerAvailabilityNotes !== undefined && {
          customerAvailabilityNotes: data.customerAvailabilityNotes,
        }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
        ...(data.isWarrantyCovered !== undefined && { isWarrantyCovered: data.isWarrantyCovered }),
        ...(data.billingStatus !== undefined && { billingStatus: data.billingStatus }),
        ...(data.estimatedCost !== undefined && {
          estimatedCost: data.estimatedCost !== null ? new Prisma.Decimal(data.estimatedCost) : null,
        }),
        ...(data.finalCost !== undefined && {
          finalCost: data.finalCost !== null ? new Prisma.Decimal(data.finalCost) : null,
        }),
        ...(data.dueDate !== undefined && {
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
        }),
        ...(data.internalNotes !== undefined && { internalNotes: data.internalNotes }),
        ...(attachments !== undefined && {
          attachments: attachments as unknown as Prisma.InputJsonValue,
        }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
      include: {
        category: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
  }

  /**
   * Assign or re-assign technician
   */
  async assign(organizationId: string, id: string, data: AssignServiceRequestInput) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        assignedToId: data.assignedToId,
        assignedAt: new Date(),
        status: "ASSIGNED",
        ...(data.internalNotes && { internalNotes: data.internalNotes }),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
  }

  /**
   * Update request status
   */
  async updateStatus(organizationId: string, id: string, status: ServiceRequestStatus) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Resolve service request
   */
  async resolve(organizationId: string, id: string, data: ResolveServiceRequestInput) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedNotes: data.resolvedNotes,
        ...(data.finalCost !== undefined && {
          finalCost: data.finalCost !== null ? new Prisma.Decimal(data.finalCost) : null,
        }),
        ...(data.billingStatus !== undefined && { billingStatus: data.billingStatus }),
        ...(data.isPaid !== undefined && { isPaid: data.isPaid }),
      },
    });
  }

  /**
   * Close service request formally
   */
  async close(organizationId: string, id: string) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });
  }

  /**
   * Reopen a closed or resolved service request
   */
  async reopen(organizationId: string, id: string, data: ReopenServiceRequestInput) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        status: "REOPENED",
        isReopened: true,
        reopenReason: data.reopenReason,
      },
    });
  }

  /**
   * Soft delete service request
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.afterSalesServiceRequest.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const serviceRequestRepository = new ServiceRequestRepository();
