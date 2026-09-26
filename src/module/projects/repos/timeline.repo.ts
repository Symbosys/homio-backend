import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateTimelineInput,
  UpdateTimelineInput,
  GetTimelinesQuery,
} from "../validators/timeline.validator.js";

/**
 * Data access repository for ProjectTimeline operations
 */
export class TimelineRepository {
  /**
   * Create a new ProjectTimeline event entry
   */
  async create(
    projectId: string,
    data: CreateTimelineInput,
    createdById?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      eventDate,
      attachments,
      metadata,
      additionalInformation,
      ...directFields
    } = data;

    return db.projectTimeline.create({
      data: {
        ...directFields,
        projectId,
        createdById: createdById || null,
        eventDate: eventDate ? new Date(eventDate) : new Date(),
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation
          ? (additionalInformation as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        performedBy: {
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated list of timeline events for a project
   */
  async findMany(projectId: string, query: GetTimelinesQuery) {
    const {
      page = 1,
      limit = 50,
      search,
      eventType,
      category,
      status,
      isCustom,
      startDate,
      endDate,
      sortBy = "eventDate",
      sortOrder = "asc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectTimelineWhereInput = {
      projectId,
      ...(eventType && { eventType }),
      ...(category && { category: { contains: category, mode: "insensitive" } }),
      ...(status && { status }),
      ...(isCustom !== undefined && { isCustom }),
      ...(startDate && {
        eventDate: {
          gte: new Date(startDate),
        },
      }),
      ...(endDate && {
        eventDate: {
          lte: new Date(endDate),
        },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.projectTimeline.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          performedBy: {
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
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.projectTimeline.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a single timeline event by ID and Project ID
   */
  async findById(id: string, projectId: string) {
    return prisma.projectTimeline.findFirst({
      where: {
        id,
        projectId,
      },
      include: {
        project: {
          select: {
            id: true,
            organizationId: true,
            projectCode: true,
            name: true,
          },
        },
        performedBy: {
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Update a timeline event
   */
  async update(
    id: string,
    projectId: string,
    data: UpdateTimelineInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      eventDate,
      attachments,
      metadata,
      additionalInformation,
      ...directFields
    } = data;

    return db.projectTimeline.update({
      where: { id },
      data: {
        ...directFields,
        ...(eventDate && { eventDate: new Date(eventDate) }),
        ...(attachments !== undefined && {
          attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
        ...(metadata !== undefined && {
          metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
        ...(additionalInformation !== undefined && {
          additionalInformation: additionalInformation
            ? (additionalInformation as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
      include: {
        performedBy: {
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
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Delete a timeline event
   */
  async delete(id: string) {
    return prisma.projectTimeline.delete({
      where: { id },
    });
  }
}
