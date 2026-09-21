import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateSiteVisitInput,
  UpdateSiteVisitInput,
  CompleteSiteVisitInput,
  GetSiteVisitsQuery,
} from "../validators/site-visit.validator.js";

export class SiteVisitRepository {
  /**
   * Create a new ProjectSiteVisit entry
   */
  async create(projectId: string, data: CreateSiteVisitInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { plannedDate, actualDate, attachments, ...directFields } = data;

    return db.projectSiteVisit.create({
      data: {
        ...directFields,
        projectId,
        plannedDate: new Date(plannedDate),
        actualDate: actualDate ? new Date(actualDate) : null,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
          },
        },
        visitorEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated list of site visits scoped to organization
   */
  async findAll(organizationId: string, query: GetSiteVisitsQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      projectId,
      milestoneId,
      visitorEmployeeId,
      visitType,
      status,
      outcome,
      startDate,
      endDate,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectSiteVisitWhereInput = {
      isDeleted: false,
      project: {
        organizationId,
        isDeleted: false,
      },
      ...(projectId && { projectId }),
      ...(milestoneId && { milestoneId }),
      ...(visitorEmployeeId && { visitorEmployeeId }),
      ...(visitType && { visitType: visitType as any }),
      ...(status && { status: status as any }),
      ...(outcome && { outcome: outcome as any }),
      ...(startDate &&
        endDate && {
          plannedDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(startDate &&
        !endDate && {
          plannedDate: {
            gte: new Date(startDate),
          },
        }),
      ...(!startDate &&
        endDate && {
          plannedDate: {
            lte: new Date(endDate),
          },
        }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { purpose: { contains: search, mode: "insensitive" } },
          { summary: { contains: search, mode: "insensitive" } },
          { issuesIdentified: { contains: search, mode: "insensitive" } },
          { actionItems: { contains: search, mode: "insensitive" } },
          { clientRepresentative: { contains: search, mode: "insensitive" } },
          { project: { name: { contains: search, mode: "insensitive" } } },
          { project: { projectCode: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.projectSiteVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
            },
          },
          visitorEmployee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              designation: true,
            },
          },
          milestone: {
            select: {
              id: true,
              milestoneCode: true,
              name: true,
              stage: true,
            },
          },
        },
      }),
      db.projectSiteVisit.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single site visit by ID with tenant verification
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectSiteVisit.findFirst({
      where: {
        id,
        isDeleted: false,
        project: {
          organizationId,
          isDeleted: false,
        },
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            organizationId: true,
          },
        },
        visitorEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
            workEmail: true,
            workPhone: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Update site visit parameters
   */
  async update(id: string, data: UpdateSiteVisitInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { plannedDate, actualDate, attachments, ...directFields } = data;

    const updatePayload: Prisma.ProjectSiteVisitUpdateInput = {
      ...directFields,
      ...(plannedDate && { plannedDate: new Date(plannedDate) }),
      ...(actualDate !== undefined && { actualDate: actualDate ? new Date(actualDate) : null }),
      ...(attachments !== undefined && {
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
    };

    return db.projectSiteVisit.update({
      where: { id },
      data: updatePayload,
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
          },
        },
        visitorEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
          },
        },
      },
    });
  }

  /**
   * Complete site visit with inspection summary and defect snags
   */
  async complete(id: string, data: CompleteSiteVisitInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { actualDate, attachments, ...directFields } = data;

    return db.projectSiteVisit.update({
      where: { id },
      data: {
        ...directFields,
        status: "COMPLETED",
        actualDate: actualDate ? new Date(actualDate) : new Date(),
        ...(attachments !== undefined && {
          attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
          },
        },
        visitorEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a site visit
   */
  async delete(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectSiteVisit.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const siteVisitRepo = new SiteVisitRepository();
