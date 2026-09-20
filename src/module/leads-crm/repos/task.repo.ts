import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  GetTasksQueryInput,
  GetTaskKanbanQueryInput,
  TaskAssigneeInput,
  AddChecklistItemInput,
  UpdateChecklistItemInput,
  AddTaskActivityInput,
} from "../validators/task.validator.js";

export class TaskRepository {
  /**
   * Create a new Task with multi-employee assignees and checklist items
   */
  async create(
    organizationId: string,
    data: CreateTaskInput & {
      taskCode: string;
      createdById?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      assignees,
      checklistItems,
      startDate,
      dueDate,
      remindAt,
      tags,
      customFields,
      ...directFields
    } = data;

    return db.task.create({
      data: {
        ...directFields,
        organizationId,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        remindAt: remindAt ? new Date(remindAt) : null,
        tags: tags || [],
        customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        ...(assignees && assignees.length > 0
          ? {
              assignees: {
                create: assignees.map((a) => ({
                  organizationId,
                  employeeId: a.employeeId,
                  isPrimary: a.isPrimary || false,
                  assignedById: data.createdById || null,
                })),
              },
            }
          : {}),
        ...(checklistItems && checklistItems.length > 0
          ? {
              checklistItems: {
                create: checklistItems.map((item, idx) => ({
                  organizationId,
                  title: item.title,
                  sortOrder: item.sortOrder ?? idx,
                })),
              },
            }
          : {}),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                workEmail: true,
              },
            },
          },
        },
        lead: { select: { id: true, leadCode: true, title: true, status: true } },
        customer: { select: { id: true, customerCode: true, firstName: true, lastName: true } },
        checklistItems: { orderBy: { sortOrder: "asc" } },
      },
    });
  }

  /**
   * Find single task by ID with assignees, checklist, activities, and documents
   */
  async findById(id: string, organizationId: string) {
    return prisma.task.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                designation: true,
                workEmail: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            priority: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
          },
        },
        checklistItems: {
          orderBy: { sortOrder: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: {
            performedBy: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find all tasks with pagination, filters, and search
   */
  async findAll(organizationId: string, query: GetTasksQueryInput) {
    const {
      page,
      limit,
      search,
      status,
      priority,
      type,
      leadId,
      customerId,
      projectId,
      employeeId,
      assignedToId,
      fromDueDate,
      toDueDate,
      fromDate,
      toDate,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const effectiveFrom = startDate || fromDate || fromDueDate;
    const effectiveTo = endDate || toDate || toDueDate;
    const effectiveEmployeeId = employeeId || assignedToId;

    const where: Prisma.TaskWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(leadId ? { leadId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(effectiveEmployeeId
        ? {
            OR: [
              { assignedToId: effectiveEmployeeId },
              { assignees: { some: { employeeId: effectiveEmployeeId } } },
            ],
          }
        : {}),
      ...(effectiveFrom || effectiveTo
        ? {
            dueDate: {
              ...(effectiveFrom ? { gte: new Date(effectiveFrom) } : {}),
              ...(effectiveTo ? { lte: new Date(effectiveTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { taskCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              {
                assignees: {
                  some: {
                    employee: {
                      OR: [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                        { employeeCode: { contains: search, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedTo: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          assignees: {
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
            },
          },
          lead: { select: { id: true, leadCode: true, title: true, status: true } },
          customer: { select: { id: true, customerCode: true, firstName: true, lastName: true } },
          _count: {
            select: {
              checklistItems: true,
              activities: true,
              documents: true,
            },
          },
        },
      }),
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
   * Kanban Board grouping by status
   */
  async getKanban(organizationId: string, query: GetTaskKanbanQueryInput) {
    const { search, priority, type, leadId, customerId, projectId, employeeId, assignedToId } = query;
    const effectiveEmployeeId = employeeId || assignedToId;

    const where: Prisma.TaskWhereInput = {
      organizationId,
      isDeleted: false,
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(leadId ? { leadId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(projectId ? { projectId } : {}),
      ...(effectiveEmployeeId
        ? {
            OR: [
              { assignedToId: effectiveEmployeeId },
              { assignees: { some: { employeeId: effectiveEmployeeId } } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { taskCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
      include: {
        assignees: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        lead: { select: { id: true, leadCode: true, title: true } },
        customer: { select: { id: true, customerCode: true, firstName: true, lastName: true } },
        _count: {
          select: {
            checklistItems: true,
            activities: true,
            documents: true,
          },
        },
      },
    });

    const columns: Record<string, typeof tasks> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      BLOCKED: [],
      COMPLETED: [],
      CANCELLED: [],
    };

    for (const task of tasks) {
      columns[task.status]?.push(task);
    }

    return {
      columns,
      total: tasks.length,
    };
  }

  /**
   * Update task details
   */
  async update(id: string, organizationId: string, data: UpdateTaskInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { startDate, dueDate, completedAt, remindAt, customFields, assignees, ...directFields } = data;

    if (assignees !== undefined) {
      await db.taskAssignee.deleteMany({
        where: { taskId: id },
      });

      if (assignees.length > 0) {
        await db.taskAssignee.createMany({
          data: assignees.map((a) => ({
            organizationId,
            taskId: id,
            employeeId: a.employeeId,
            isPrimary: a.isPrimary || false,
          })),
        });
      }
    }

    return db.task.update({
      where: { id },
      data: {
        ...directFields,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(completedAt !== undefined ? { completedAt: completedAt ? new Date(completedAt) : null } : {}),
        ...(remindAt !== undefined ? { remindAt: remindAt ? new Date(remindAt) : null } : {}),
        ...(customFields !== undefined
          ? { customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
      include: {
        assignedTo: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        assignees: {
          include: {
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  /**
   * Generate sequential task code (e.g. TASK-2026-0001)
   */
  async generateTaskCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const count = await db.task.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
        },
      },
    });

    return `TASK-${currentYear}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Assignees operations
   */
  async addAssignees(organizationId: string, taskId: string, assignees: TaskAssigneeInput[], assignedById?: string | null) {
    return prisma.$transaction(async (tx) => {
      for (const a of assignees) {
        await tx.taskAssignee.upsert({
          where: {
            taskId_employeeId: {
              taskId,
              employeeId: a.employeeId,
            },
          },
          create: {
            organizationId,
            taskId,
            employeeId: a.employeeId,
            isPrimary: a.isPrimary || false,
            assignedById: assignedById || null,
          },
          update: {
            isPrimary: a.isPrimary || false,
          },
        });
      }

      return tx.taskAssignee.findMany({
        where: { taskId },
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
        },
      });
    });
  }

  async removeAssignee(taskId: string, employeeId: string) {
    return prisma.taskAssignee.delete({
      where: {
        taskId_employeeId: {
          taskId,
          employeeId,
        },
      },
    });
  }

  async setPrimaryAssignee(taskId: string, employeeId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.taskAssignee.updateMany({
        where: { taskId },
        data: { isPrimary: false },
      });

      return tx.taskAssignee.update({
        where: {
          taskId_employeeId: {
            taskId,
            employeeId,
          },
        },
        data: { isPrimary: true },
      });
    });
  }

  /**
   * Checklist operations
   */
  async addChecklistItem(organizationId: string, taskId: string, data: AddChecklistItemInput) {
    return prisma.taskChecklistItem.create({
      data: {
        organizationId,
        taskId,
        title: data.title,
        sortOrder: data.sortOrder || 0,
      },
    });
  }

  async updateChecklistItem(itemId: string, data: UpdateChecklistItemInput) {
    const { isCompleted, ...directFields } = data;
    return prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        ...directFields,
        ...(isCompleted !== undefined ? { isCompleted, completedAt: isCompleted ? new Date() : null } : {}),
      },
    });
  }

  async deleteChecklistItem(itemId: string) {
    return prisma.taskChecklistItem.delete({
      where: { id: itemId },
    });
  }

  /**
   * Task Activity / Comment operations
   */
  async addActivity(organizationId: string, taskId: string, data: AddTaskActivityInput) {
    return prisma.taskActivity.create({
      data: {
        organizationId,
        taskId,
        type: data.type || "COMMENT",
        content: data.content,
        performedById: data.performedById || null,
        metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async deleteActivity(activityId: string) {
    return prisma.taskActivity.delete({
      where: { id: activityId },
    });
  }

  /**
   * Document operations
   */
  async createDocument(data: {
    organizationId: string;
    taskId: string;
    name: string;
    fileUrl: Prisma.InputJsonValue;
    uploadedById?: string | null;
  }) {
    return prisma.taskDocument.create({
      data: {
        organizationId: data.organizationId,
        taskId: data.taskId,
        name: data.name,
        fileUrl: data.fileUrl,
        uploadedById: data.uploadedById || null,
      },
    });
  }

  async deleteDocument(id: string) {
    return prisma.taskDocument.delete({
      where: { id },
    });
  }

  /**
   * Bulk actions
   */
  async bulkUpdateStatus(taskIds: string[], organizationId: string, status: any) {
    return prisma.task.updateMany({
      where: { id: { in: taskIds }, organizationId, isDeleted: false },
      data: {
        status,
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });
  }

  async bulkUpdatePriority(taskIds: string[], organizationId: string, priority: any) {
    return prisma.task.updateMany({
      where: { id: { in: taskIds }, organizationId, isDeleted: false },
      data: { priority },
    });
  }

  async bulkAssign(taskIds: string[], organizationId: string, assignedToId: string | null) {
    return prisma.task.updateMany({
      where: { id: { in: taskIds }, organizationId, isDeleted: false },
      data: { assignedToId },
    });
  }

  async bulkDelete(taskIds: string[], organizationId: string) {
    return prisma.task.updateMany({
      where: { id: { in: taskIds }, organizationId, isDeleted: false },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async softDelete(id: string, organizationId: string) {
    return prisma.task.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }
}

export const taskRepo = new TaskRepository();
