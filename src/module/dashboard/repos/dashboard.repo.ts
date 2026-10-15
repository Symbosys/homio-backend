import { prisma } from "../../../lib/prisma.js";
import { Prisma, TaskStatus, ProjectStatus, ProjectHealth } from "../../../types/types.js";

/**
 * Repository layer for Dashboard Operations & Analytics
 * Directly accesses Tasks, Projects, and Sub-Models scoped by organization
 */
export class DashboardRepository {
  /**
   * Fetch all tenant tasks for analytics (optionally filtered by assigned employee)
   */
  async getTasksForDashboard(
    organizationId: string,
    employeeId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.task.findMany({
      where: {
        organizationId,
        isDeleted: false,
        ...(employeeId
          ? {
              OR: [
                { assignedToId: employeeId },
                { assignees: { some: { employeeId } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        taskCode: true,
        title: true,
        type: true,
        priority: true,
        status: true,
        checklistTotal: true,
        checklistCompleted: true,
        progressPercentage: true,
        startDate: true,
        dueDate: true,
        submittedForReviewAt: true,
        completedAt: true,
        reviewedAt: true,
        reviewRemarks: true,
        estimatedHours: true,
        actualHours: true,
        createdAt: true,
        updatedAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
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
              },
            },
          },
        },
      },
    });
  }

  /**
   * Fetch all tenant projects for analytics (with site, schedule, metric, commercial, dynamic members)
   */
  async getProjectsForDashboard(
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.project.findMany({
      where: {
        organizationId,
        isDeleted: false,
      },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        site: {
          select: {
            siteName: true,
            city: true,
            propertyType: true,
          },
        },
        schedule: {
          select: {
            plannedStartDate: true,
            plannedEndDate: true,
            siteHandoverDate: true,
            actualEndDate: true,
          },
        },
        metric: {
          select: {
            progressPercent: true,
            designProgress: true,
            executionProgress: true,
            procurementProgress: true,
            qualityScore: true,
            safetyScore: true,
          },
        },
        commercial: {
          select: {
            contractAmount: true,
            currency: true,
          },
        },
        members: {
          where: { isActive: true },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                designation: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find tasks currently submitted under review awaiting approval
   */
  async findTasksUnderReview(
    organizationId: string,
    employeeId?: string,
    limit: number = 10,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.task.findMany({
      where: {
        organizationId,
        isDeleted: false,
        status: TaskStatus.UNDER_REVIEW,
        ...(employeeId
          ? {
              OR: [
                { assignedToId: employeeId },
                { assignees: { some: { employeeId } } },
              ],
            }
          : {}),
      },
      orderBy: { submittedForReviewAt: "desc" },
      take: limit,
      select: {
        id: true,
        taskCode: true,
        title: true,
        submittedForReviewAt: true,
        updatedAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
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
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find tasks with dueDate in the past that are still pending resolution
   */
  async findOverdueTasks(
    organizationId: string,
    employeeId?: string,
    limit: number = 10,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const now = new Date();
    return db.task.findMany({
      where: {
        organizationId,
        isDeleted: false,
        dueDate: { lt: now },
        status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] },
        ...(employeeId
          ? {
              OR: [
                { assignedToId: employeeId },
                { assignees: { some: { employeeId } } },
              ],
            }
          : {}),
      },
      orderBy: { dueDate: "asc" },
      take: limit,
      select: {
        id: true,
        taskCode: true,
        title: true,
        dueDate: true,
        priority: true,
        status: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
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
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find tasks rejected during review and marked for immediate rework
   */
  async findReworkTasks(
    organizationId: string,
    employeeId?: string,
    limit: number = 10,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.task.findMany({
      where: {
        organizationId,
        isDeleted: false,
        status: TaskStatus.RE_WORK,
        ...(employeeId
          ? {
              OR: [
                { assignedToId: employeeId },
                { assignees: { some: { employeeId } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        taskCode: true,
        title: true,
        reviewRemarks: true,
        reviewedAt: true,
        updatedAt: true,
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
          },
        },
      },
    });
  }

  /**
   * Find active projects flagged with health risk (AT_RISK or NEED_ATTENTION)
   */
  async findAtRiskProjects(
    organizationId: string,
    limit: number = 10,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.project.findMany({
      where: {
        organizationId,
        isDeleted: false,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CLOSED, ProjectStatus.CANCELLED] },
        health: { in: [ProjectHealth.AT_RISK, ProjectHealth.NEED_ATTENTION] },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        projectCode: true,
        name: true,
        health: true,
        currentStage: true,
        updatedAt: true,
        site: {
          select: {
            siteName: true,
            city: true,
          },
        },
      },
    });
  }

  /**
   * Find active projects with scheduled handover or possession within the next 30 days
   */
  async findUpcomingHandoverProjects(
    organizationId: string,
    limit: number = 10,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const now = new Date();
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);

    return db.project.findMany({
      where: {
        organizationId,
        isDeleted: false,
        status: { notIn: [ProjectStatus.COMPLETED, ProjectStatus.CLOSED, ProjectStatus.CANCELLED] },
        schedule: {
          OR: [
            { siteHandoverDate: { gte: now, lte: next30Days } },
            { plannedEndDate: { gte: now, lte: next30Days } },
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        projectCode: true,
        name: true,
        currentStage: true,
        updatedAt: true,
        schedule: {
          select: {
            siteHandoverDate: true,
            plannedEndDate: true,
          },
        },
        site: {
          select: {
            siteName: true,
            city: true,
          },
        },
      },
    });
  }
}

export const dashboardRepo = new DashboardRepository();
