import { prisma } from "../../../lib/prisma.js";
import { Prisma, type ImageType, WarrantyStatus } from "../../../types/types.js";
import type {
  CreateProjectWarrantyInput,
  UpdateProjectWarrantyInput,
  GetProjectWarrantiesQueryInput,
} from "../validators/warranty.validator.js";

export class WarrantyRepository {
  /**
   * Auto-generates sequential warranty code scoped to organization and year (WAR-YYYY-NNNN)
   */
  async generateNextWarrantyNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WAR-${year}-`;

    const latest = await prisma.projectWarranty.findFirst({
      where: {
        project: { organizationId },
        warrantyNumber: { startsWith: prefix },
      },
      orderBy: { warrantyNumber: "desc" },
      select: { warrantyNumber: true },
    });

    let nextSeq = 1;
    if (latest?.warrantyNumber) {
      const parts = latest.warrantyNumber.split("-");
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
   * Create a new project warranty
   */
  async create(
    organizationId: string,
    data: CreateProjectWarrantyInput,
    policyDocumentUrl?: ImageType | null
  ) {
    const warrantyNumber = await this.generateNextWarrantyNumber(organizationId);

    return prisma.projectWarranty.create({
      data: {
        projectId: data.projectId,
        handoverId: data.handoverId,
        warrantyNumber,
        category: data.category,
        title: data.title,
        description: data.description,
        coveredItemWork: data.coveredItemWork,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        status: data.status || "ACTIVE",
        termsSummary: data.termsSummary,
        inclusions: data.inclusions,
        exclusions: data.exclusions,
        policyDocumentUrl: policyDocumentUrl ? (policyDocumentUrl as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        additionalInformation: data.additionalInformation !== undefined ? (data.additionalInformation as Prisma.InputJsonValue) : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        handover: {
          select: { id: true, handoverNumber: true, status: true },
        },
        _count: {
          select: { claims: true, serviceRequests: true },
        },
      },
    });
  }

  /**
   * Find warranty by ID with tenant verification
   */
  async findById(organizationId: string, id: string) {
    return prisma.projectWarranty.findFirst({
      where: {
        id,
        project: { organizationId },
        isDeleted: false,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        handover: {
          select: { id: true, handoverNumber: true, status: true, handoverDate: true },
        },
        claims: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        serviceRequests: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: { claims: true, serviceRequests: true },
        },
      },
    });
  }

  /**
   * List paginated warranties
   */
  async list(organizationId: string, query: GetProjectWarrantiesQueryInput) {
    const {
      projectId,
      handoverId,
      status,
      category,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWarrantyWhereInput = {
      project: { organizationId },
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(handoverId && { handoverId }),
      ...(status && { status }),
      ...(category && { category: { contains: category, mode: "insensitive" } }),
      ...(startDate && { startDate: { gte: new Date(startDate) } }),
      ...(endDate && { endDate: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { warrantyNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { coveredItemWork: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.projectWarranty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: { id: true, name: true, projectCode: true },
          },
          _count: {
            select: { claims: true, serviceRequests: true },
          },
        },
      }),
      prisma.projectWarranty.count({ where }),
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
   * Partial update warranty details & document
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateProjectWarrantyInput,
    policyDocumentUrl?: ImageType | null
  ) {
    return prisma.projectWarranty.update({
      where: { id },
      data: {
        ...(data.handoverId !== undefined && { handoverId: data.handoverId }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coveredItemWork !== undefined && { coveredItemWork: data.coveredItemWork }),
        ...(data.startDate !== undefined && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: new Date(data.endDate) }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.termsSummary !== undefined && { termsSummary: data.termsSummary }),
        ...(data.inclusions !== undefined && { inclusions: data.inclusions }),
        ...(data.exclusions !== undefined && { exclusions: data.exclusions }),
        ...(policyDocumentUrl !== undefined && {
          policyDocumentUrl: policyDocumentUrl ? (policyDocumentUrl as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true },
        },
      },
    });
  }

  /**
   * Update warranty status
   */
  async updateStatus(organizationId: string, id: string, status: WarrantyStatus) {
    return prisma.projectWarranty.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Soft delete warranty
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.projectWarranty.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const warrantyRepository = new WarrantyRepository();
