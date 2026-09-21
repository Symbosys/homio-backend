import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateProgressInput,
  UpdateProgressInput,
  GetProgressQueryInput,
} from "../validators/progress.validator.js";

export class ProgressRepository {
  /**
   * Create a new site progress field log
   */
  async create(
    projectId: string,
    data: CreateProgressInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const { progressDate, media, ...directFields } = data;

    return db.projectProgress.create({
      data: {
        ...directFields,
        projectId,
        progressDate: new Date(progressDate),
        media: media
          ? (media as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        submittedBy: {
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
   * List paginated progress logs for a project with multiple filters
   */
  async findAll(
    projectId: string,
    query: GetProgressQueryInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      milestoneId,
      areaRoom,
      workStage,
      approvalStatus,
      visibility,
      startDate,
      endDate,
      submittedById,
      sortBy = "progressDate",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectProgressWhereInput = {
      projectId,
      isDeleted: false,
      ...(milestoneId ? { milestoneId } : {}),
      ...(areaRoom
        ? { areaRoom: { contains: areaRoom, mode: "insensitive" } }
        : {}),
      ...(workStage
        ? { workStage: { contains: workStage, mode: "insensitive" } }
        : {}),
      ...(approvalStatus ? { approvalStatus } : {}),
      ...(visibility ? { visibility } : {}),
      ...(submittedById ? { submittedById } : {}),
      ...(startDate || endDate
        ? {
            progressDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      db.projectProgress.count({ where }),
      db.projectProgress.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          submittedBy: {
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
          approvedBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
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
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: entries,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single progress log by ID
   */
  async findById(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectProgress.findFirst({
      where: {
        id,
        projectId,
        isDeleted: false,
      },
      include: {
        submittedBy: {
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
        approvedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
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
   * Update progress log
   */
  async update(
    id: string,
    projectId: string,
    data: UpdateProgressInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const { progressDate, media, ...directFields } = data;

    const updateData: Prisma.ProjectProgressUpdateInput = {
      ...directFields,
      updatedAt: new Date(),
    };

    if (progressDate) {
      updateData.progressDate = new Date(progressDate);
    }
    if (media !== undefined) {
      updateData.media = media
        ? (media as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    return db.projectProgress.update({
      where: {
        id,
        projectId,
      },
      data: updateData,
      include: {
        submittedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Review and stamp approval status on site progress report
   */
  async review(
    id: string,
    projectId: string,
    approvalStatus: "APPROVED" | "REJECTED" | "REVISION_REQUESTED",
    approvedById?: string,
    rejectionReason?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.projectProgress.update({
      where: {
        id,
        projectId,
      },
      data: {
        approvalStatus,
        approvedById: approvedById || null,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || null,
        updatedAt: new Date(),
      },
      include: {
        approvedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete progress log
   */
  async softDelete(
    id: string,
    projectId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.projectProgress.update({
      where: {
        id,
        projectId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const progressRepo = new ProgressRepository();
