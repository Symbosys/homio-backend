import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateMilestoneInput,
  UpdateMilestoneInput,
  GetMilestonesQueryInput,
} from "../validators/milestone.validator.js";

export class MilestoneRepository {
  /**
   * Auto-generate sequential Project Milestone Code e.g. "MS-01", "MS-02"
   */
  async generateMilestoneCode(projectId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const count = await db.projectMilestone.count({
      where: { projectId },
    });
    return `MS-${String(count + 1).padStart(2, "0")}`;
  }

  /**
   * Create a milestone with optional nested checklist items
   */
  async create(
    projectId: string,
    data: CreateMilestoneInput & { milestoneCode: string },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { checklists, attachments, budgetAmount, startDate, dueDate, actualStartDate, completedAt, ...directFields } = data;

    return db.projectMilestone.create({
      data: {
        ...directFields,
        projectId,
        startDate: new Date(startDate),
        dueDate: new Date(dueDate),
        actualStartDate: actualStartDate ? new Date(actualStartDate) : null,
        completedAt: completedAt ? new Date(completedAt) : null,
        budgetAmount: budgetAmount !== undefined && budgetAmount !== null ? new Prisma.Decimal(budgetAmount) : null,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        checklists: checklists && checklists.length > 0
          ? {
              create: checklists.map((c, index) => ({
                title: c.title,
                isCompleted: c.isCompleted ?? false,
                completedAt: c.completedAt ? new Date(c.completedAt) : null,
                dueDate: c.dueDate ? new Date(c.dueDate) : null,
                orderIndex: c.orderIndex ?? index,
                assigneeId: c.assigneeId || null,
              })),
            }
          : undefined,
      },
      include: {
        assignee: {
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
        checklists: {
          orderBy: { orderIndex: "asc" },
          include: {
            assignee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find all milestones for a project with checklist summary
   */
  async findAll(projectId: string, query: GetMilestonesQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { stage, status, priority, assigneeId, sortBy = "orderIndex", sortOrder = "asc" } = query;

    const where: Prisma.ProjectMilestoneWhereInput = {
      projectId,
      isDeleted: false,
      ...(stage ? { stage } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };

    return db.projectMilestone.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      include: {
        assignee: {
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
        checklists: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            title: true,
            isCompleted: true,
            completedAt: true,
            dueDate: true,
            orderIndex: true,
            assigneeId: true,
          },
        },
      },
    });
  }

  /**
   * Get single milestone by ID with full details
   */
  async findById(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectMilestone.findFirst({
      where: {
        id,
        projectId,
        isDeleted: false,
      },
      include: {
        assignee: {
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
        checklists: {
          orderBy: { orderIndex: "asc" },
          include: {
            assignee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
          },
        },
        progressEntries: {
          where: { isDeleted: false },
          orderBy: { progressDate: "desc" },
          take: 5,
        },
      },
    });
  }

  /**
   * Update milestone fields and sync checklist items
   */
  async update(
    id: string,
    projectId: string,
    data: UpdateMilestoneInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { checklists, attachments, budgetAmount, startDate, dueDate, actualStartDate, completedAt, ...directFields } = data;

    const updateData: Prisma.ProjectMilestoneUpdateInput = {
      ...directFields,
      updatedAt: new Date(),
    };

    if (startDate) updateData.startDate = new Date(startDate);
    if (dueDate) updateData.dueDate = new Date(dueDate);
    if (actualStartDate !== undefined) updateData.actualStartDate = actualStartDate ? new Date(actualStartDate) : null;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;
    if (budgetAmount !== undefined) {
      updateData.budgetAmount = budgetAmount !== null ? new Prisma.Decimal(budgetAmount) : null;
    }
    if (attachments !== undefined) {
      updateData.attachments = attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    if (checklists !== undefined) {
      // Delete existing and replace with new set
      await db.milestoneChecklist.deleteMany({
        where: { milestoneId: id },
      });

      if (checklists.length > 0) {
        updateData.checklists = {
          create: checklists.map((c, index) => ({
            title: c.title,
            isCompleted: c.isCompleted ?? false,
            completedAt: c.completedAt ? new Date(c.completedAt) : null,
            dueDate: c.dueDate ? new Date(c.dueDate) : null,
            orderIndex: c.orderIndex ?? index,
            assigneeId: c.assigneeId || null,
          })),
        };
      }
    }

    return db.projectMilestone.update({
      where: {
        id,
        projectId,
      },
      data: updateData,
      include: {
        assignee: {
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
        checklists: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  /**
   * Toggle single checklist item state
   */
  async toggleChecklist(
    checklistId: string,
    milestoneId: string,
    isCompleted?: boolean,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const checklist = await db.milestoneChecklist.findFirst({
      where: {
        id: checklistId,
        milestoneId,
      },
    });
    if (!checklist) return null;

    const nextState = isCompleted !== undefined ? isCompleted : !checklist.isCompleted;

    return db.milestoneChecklist.update({
      where: { id: checklistId },
      data: {
        isCompleted: nextState,
        completedAt: nextState ? new Date() : null,
      },
    });
  }

  /**
   * Soft delete milestone
   */
  async softDelete(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectMilestone.update({
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

export const milestoneRepo = new MilestoneRepository();
