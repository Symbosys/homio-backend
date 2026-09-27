import { prisma } from "../../../lib/prisma.js";
import { Prisma, TaskStatus, ProjectStage } from "../../../types/types.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  GetTasksQueryInput,
} from "../validators/task.validator.js";

/**
 * Repository layer for Task Management and Project Stage Calculations
 */
export class TaskRepository {
  /**
   * Auto-generate sequential, tenant-scoped Task Code (e.g. "TASK-2026-0001")
   */
  async generateTaskCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `TASK-${currentYear}-`;

    const latestTask = await db.task.findFirst({
      where: {
        organizationId,
        taskCode: { startsWith: prefix },
      },
      orderBy: { taskCode: "desc" },
      select: { taskCode: true },
    });

    let nextNumber = 1;
    if (latestTask?.taskCode) {
      const parts = latestTask.taskCode.split("-");
      const seqStr = parts[2];
      if (seqStr) {
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  /**
   * Create a new task with assignees inside an atomic transaction
   */
  async create(
    organizationId: string,
    data: CreateTaskInput & { taskCode: string },
    createdById?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { assigneeIds, checklist, ...taskData } = data;

    // Calculate checklist statistics if checklist provided
    let checklistTotal = 0;
    let checklistCompleted = 0;
    let progressPercentage = 0;

    if (Array.isArray(checklist) && checklist.length > 0) {
      checklistTotal = checklist.length;
      checklistCompleted = checklist.filter((item) => item.isCompleted).length;
      progressPercentage = Math.round((checklistCompleted / checklistTotal) * 100);
    }

    const task = await db.task.create({
      data: {
        ...taskData,
        organizationId,
        createdById,
        checklistTotal,
        checklistCompleted,
        progressPercentage,
        checklist: checklist ? (checklist as any) : undefined,
        customFields: taskData.customFields ? (taskData.customFields as any) : undefined,
        additionalInformation: taskData.additionalInformation
          ? (taskData.additionalInformation as any)
          : undefined,
        startDate: taskData.startDate ? new Date(taskData.startDate) : undefined,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : undefined,
        status: taskData.status || TaskStatus.TODO,
        assignees:
          assigneeIds && assigneeIds.length > 0
            ? {
                create: assigneeIds.map((employeeId) => ({
                  organizationId,
                  employeeId,
                })),
              }
            : undefined,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            currentStage: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        category: true,
      },
    });

    return task;
  }

  /**
   * Find paginated tasks with dynamic filters
   */
  async findMany(
    organizationId: string,
    query: GetTasksQueryInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      projectId,
      leadId,
      stage,
      status,
      priority,
      type,
      assignedToId,
      reviewerId,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(stage ? { stage } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(assignedToId
        ? {
            OR: [
              { assignedToId },
              { assignees: { some: { employeeId: assignedToId } } },
            ],
          }
        : {}),
      ...(reviewerId ? { reviewerId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { taskCode: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              currentStage: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              employeeCode: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeCode: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          assignees: {
            include: {
              employee: {
                select: {
                  id: true,
                  employeeCode: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
          category: true,
        },
      }),
      db.task.count({ where }),
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
   * Find single task by ID within tenant
   */
  async findById(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.task.findFirst({
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
            currentStage: true,
            stageStatuses: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        category: true,
      },
    });
  }

  /**
   * Update task fields & assignees
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateTaskInput & {
      submittedForReviewAt?: Date | null;
      completedAt?: Date | null;
      reviewedAt?: Date | null;
      reviewRemarks?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { assigneeIds, checklist, ...updateFields } = data;

    // Recalculate checklist progress if provided
    let checklistUpdates: Record<string, any> = {};
    if (Array.isArray(checklist)) {
      const checklistTotal = checklist.length;
      const checklistCompleted = checklist.filter((item) => item.isCompleted).length;
      const progressPercentage =
        checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

      checklistUpdates = {
        checklist: checklist as any,
        checklistTotal,
        checklistCompleted,
        progressPercentage,
      };
    }

    // Handle assignees update if explicitly provided
    if (assigneeIds !== undefined) {
      await db.taskAssignee.deleteMany({
        where: { taskId: id, organizationId },
      });

      if (assigneeIds.length > 0) {
        await db.taskAssignee.createMany({
          data: assigneeIds.map((employeeId) => ({
            taskId: id,
            organizationId,
            employeeId,
          })),
        });
      }
    }

    const updatePayload: Prisma.TaskUncheckedUpdateInput = {
      ...updateFields,
      ...checklistUpdates,
      customFields: updateFields.customFields !== undefined ? (updateFields.customFields as any) : undefined,
      additionalInformation: updateFields.additionalInformation !== undefined ? (updateFields.additionalInformation as any) : undefined,
      startDate: updateFields.startDate ? new Date(updateFields.startDate) : updateFields.startDate === null ? null : undefined,
      dueDate: updateFields.dueDate ? new Date(updateFields.dueDate) : updateFields.dueDate === null ? null : undefined,
    };

    const updatedTask = await db.task.update({
      where: { id },
      data: updatePayload,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            currentStage: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        category: true,
      },
    });

    return updatedTask;
  }

  /**
   * Soft delete task
   */
  async softDelete(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.task.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Fetch all active non-deleted tasks for a project to calculate stage metrics
   */
  async getTasksForProjectProgress(
    organizationId: string,
    projectId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.task.findMany({
      where: {
        organizationId,
        projectId,
        isDeleted: false,
      },
      select: {
        id: true,
        stage: true,
        status: true,
        priority: true,
      },
    });
  }

  /**
   * Update project stageStatuses JSON ledger and project_metrics percentages atomically
   */
  async syncProjectStageProgress(
    organizationId: string,
    projectId: string,
    stageStatuses: Record<string, any>,
    metrics: {
      overallProgress: number;
      designProgress: number;
      executionProgress: number;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    // 1. Update Project stageStatuses
    await db.project.update({
      where: { id: projectId, organizationId },
      data: {
        stageStatuses: stageStatuses as any,
      },
    });

    // 2. Update ProjectMetric aggregate
    await db.projectMetric.upsert({
      where: { projectId },
      create: {
        projectId,
        progressPercent: metrics.overallProgress,
        designProgress: metrics.designProgress,
        executionProgress: metrics.executionProgress,
        lastEvaluatedAt: new Date(),
      },
      update: {
        progressPercent: metrics.overallProgress,
        designProgress: metrics.designProgress,
        executionProgress: metrics.executionProgress,
        lastEvaluatedAt: new Date(),
      },
    });
  }
}

export const taskRepository = new TaskRepository();
