import { taskRepository, TaskRepository } from "../repos/task.repo.js";
import { prisma } from "../../../lib/prisma.js";
import {
  TaskStatus,
  ProjectStage,
  StageStatus,
  statusCode,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  GetTasksQueryInput,
  ReviewTaskDecisionInput,
} from "../validators/task.validator.js";

/**
 * All valid project stages in sequential order
 */
export const ALL_PROJECT_STAGES: ProjectStage[] = [
  ProjectStage.ONBOARDING,
  ProjectStage.SURVEY,
  ProjectStage.DESIGN,
  ProjectStage.APPROVAL,
  ProjectStage.PROCUREMENT,
  ProjectStage.EXECUTION,
  ProjectStage.HANDOVER,
  ProjectStage.AFTER_SALES,
];

/**
 * Service orchestrating Task business logic, Review workflows, and Project Stage Progress Calculations
 */
export class TaskService {
  constructor(private readonly repo: TaskRepository = taskRepository) {}

  /**
   * Create a task and automatically recalculate project stage progress if associated with a project
   */
  async createTask(organizationId: string, data: CreateTaskInput, createdById?: string) {
    // 1. If projectId provided, ensure project exists and belongs to tenant
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, organizationId, isDeleted: false },
        select: { id: true, currentStage: true },
      });

      if (!project) {
        throw new ErrorResponse("Target project not found in organization", statusCode.Not_Found);
      }

      // If stage not provided, default to project's current stage
      if (!data.stage) {
        data.stage = project.currentStage;
      }
    }

    // 2. Generate sequential unique task code
    const taskCode = await this.repo.generateTaskCode(organizationId);

    // 3. Create task record
    const task = await this.repo.create(organizationId, { ...data, taskCode }, createdById);

    // 4. If linked to a project, recalculate project stage and overall progress
    if (task.projectId) {
      await this.recalculateProjectStageProgress(organizationId, task.projectId);
    }

    return task;
  }

  /**
   * Get paginated tasks with dynamic filters
   */
  async getTasks(organizationId: string, query: GetTasksQueryInput) {
    return this.repo.findMany(organizationId, query);
  }

  /**
   * Get single task by ID
   */
  async getTaskById(organizationId: string, id: string) {
    const task = await this.repo.findById(organizationId, id);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }
    return task;
  }

  /**
   * Update task and recalculate stage progress if stage, status, or project changed
   */
  async updateTask(organizationId: string, id: string, data: UpdateTaskInput) {
    const existingTask = await this.repo.findById(organizationId, id);
    if (!existingTask) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updatedTask = await this.repo.update(organizationId, id, data);

    // Recalculate progress for existing project
    if (existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, existingTask.projectId);
    }

    // If project was changed, recalculate for new project as well
    if (data.projectId && data.projectId !== existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, data.projectId);
    }

    return updatedTask;
  }

  /**
   * Quick status change (e.g. COMPLETED, IN_PROGRESS, TODO) with stage recalculation
   */
  async updateTaskStatus(
    organizationId: string,
    id: string,
    status: TaskStatus,
    remarks?: string | null
  ) {
    const existingTask = await this.repo.findById(organizationId, id);
    if (!existingTask) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const isCompleted = status === TaskStatus.COMPLETED;
    const isUnderReview = status === TaskStatus.UNDER_REVIEW;

    const updatedTask = await this.repo.update(organizationId, id, {
      status,
      completedAt: isCompleted ? new Date() : existingTask.completedAt,
      submittedForReviewAt: isUnderReview ? new Date() : existingTask.submittedForReviewAt,
      reviewRemarks: remarks || existingTask.reviewRemarks,
    });

    if (existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, existingTask.projectId);
    }

    return updatedTask;
  }

  /**
   * Submit task for review by assigned worker
   */
  async submitForReview(organizationId: string, id: string, remarks?: string | null) {
    const existingTask = await this.repo.findById(organizationId, id);
    if (!existingTask) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updatedTask = await this.repo.update(organizationId, id, {
      status: TaskStatus.UNDER_REVIEW,
      submittedForReviewAt: new Date(),
      reviewRemarks: remarks || undefined,
    });

    if (existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, existingTask.projectId);
    }

    return updatedTask;
  }

  /**
   * Helper: Resolve employee entity for current user or throw (HRMS Standard)
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        userId,
        organizationId,
        isDeleted: false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        designation: true,
        workEmail: true,
      },
    });

    if (!employee) {
      throw new ErrorResponse(
        "You are not assigned to this task. No active employee profile linked to your user account.",
        statusCode.Forbidden
      );
    }

    return employee;
  }

  /**
   * Reviewer decision: APPROVE (marks COMPLETED) or REWORK (marks RE_WORK with feedback)
   * ONLY the designated task reviewer can review
   */
  async reviewTaskDecision(
    organizationId: string,
    id: string,
    input: ReviewTaskDecisionInput,
    reviewerEmployeeId?: string,
    userId?: string
  ) {
    const existingTask = await this.repo.findById(organizationId, id);
    if (!existingTask) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    let resolvedEmployeeId = reviewerEmployeeId;
    if (userId) {
      const employee = await this.resolveEmployeeForUser(userId, organizationId);
      resolvedEmployeeId = employee.id;
    }

    if (!existingTask.reviewerId || !resolvedEmployeeId || existingTask.reviewerId !== resolvedEmployeeId) {
      throw new ErrorResponse(
        "You are not assigned to review this task. Only the designated task reviewer can review this task.",
        statusCode.Forbidden
      );
    }

    const isApproved = input.decision === "APPROVE";

    const updatedTask = await this.repo.update(organizationId, id, {
      status: isApproved ? TaskStatus.COMPLETED : TaskStatus.RE_WORK,
      reviewerId: resolvedEmployeeId,
      reviewedAt: new Date(),
      completedAt: isApproved ? new Date() : null,
      reviewRemarks: input.remarks || (isApproved ? "Approved by reviewer" : "Rework requested"),
    });

    if (existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, existingTask.projectId);
    }

    return updatedTask;
  }

  /**
   * Soft delete task and recalculate stage progress
   */
  async deleteTask(organizationId: string, id: string) {
    const existingTask = await this.repo.findById(organizationId, id);
    if (!existingTask) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    await this.repo.softDelete(organizationId, id);

    if (existingTask.projectId) {
      await this.recalculateProjectStageProgress(organizationId, existingTask.projectId);
    }

    return { id, message: "Task deleted successfully" };
  }

  /**
   * Get stage-wise task counts and completion summary for a project
   */
  async getProjectStageSummary(organizationId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
      select: { id: true, name: true, projectCode: true, stageStatuses: true },
    });

    if (!project) {
      throw new ErrorResponse("Project not found", statusCode.Not_Found);
    }

    const tasks = await this.repo.getTasksForProjectProgress(organizationId, projectId);

    const stagesSummary: Record<string, any> = {};

    ALL_PROJECT_STAGES.forEach((stage) => {
      const stageTasks = tasks.filter((t) => t.stage === stage);
      const totalTasks = stageTasks.length;
      const completedTasks = stageTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const inProgressTasks = stageTasks.filter(
        (t) =>
          t.status === TaskStatus.IN_PROGRESS ||
          t.status === TaskStatus.UNDER_REVIEW ||
          t.status === TaskStatus.RE_WORK
      ).length;
      const onHoldTasks = stageTasks.filter((t) => t.status === TaskStatus.ON_HOLD).length;

      const progressPercent =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100 * 100) / 100 : 0;

      let status: StageStatus = StageStatus.NOT_STARTED;
      if (totalTasks > 0) {
        if (completedTasks === totalTasks) {
          status = StageStatus.COMPLETED;
        } else if (onHoldTasks > 0 && completedTasks === 0 && inProgressTasks === 0) {
          status = StageStatus.ON_HOLD;
        } else if (completedTasks > 0 || inProgressTasks > 0) {
          status = StageStatus.IN_PROGRESS;
        } else {
          status = StageStatus.ASSIGNED;
        }
      }

      stagesSummary[stage] = {
        stage,
        totalTasks,
        completedTasks,
        inProgressTasks,
        onHoldTasks,
        progressPercent,
        status,
      };
    });

    return {
      projectId,
      stages: stagesSummary,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
    };
  }

  /**
   * Recalculate and synchronize all stage progress percentages and overall project metrics
   */
  async recalculateProjectStageProgress(organizationId: string, projectId: string) {
    const tasks = await this.repo.getTasksForProjectProgress(organizationId, projectId);

    const stageStatuses: Record<string, any> = {};

    let totalDesignTasks = 0;
    let completedDesignTasks = 0;
    let totalExecutionTasks = 0;
    let completedExecutionTasks = 0;

    const designStages = new Set<ProjectStage>([
      ProjectStage.SURVEY,
      ProjectStage.DESIGN,
      ProjectStage.APPROVAL,
    ]);

    ALL_PROJECT_STAGES.forEach((stage) => {
      const stageTasks = tasks.filter((t) => t.stage === stage);
      const totalTasks = stageTasks.length;
      const completedTasks = stageTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const inProgressTasks = stageTasks.filter(
        (t) =>
          t.status === TaskStatus.IN_PROGRESS ||
          t.status === TaskStatus.UNDER_REVIEW ||
          t.status === TaskStatus.RE_WORK
      ).length;
      const onHoldTasks = stageTasks.filter((t) => t.status === TaskStatus.ON_HOLD).length;

      // Progress formula: (completed / total) * 100
      const progressPercent =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100 * 100) / 100 : 0;

      let status: StageStatus = StageStatus.NOT_STARTED;
      if (totalTasks > 0) {
        if (completedTasks === totalTasks) {
          status = StageStatus.COMPLETED;
        } else if (onHoldTasks > 0 && completedTasks === 0 && inProgressTasks === 0) {
          status = StageStatus.ON_HOLD;
        } else if (completedTasks > 0 || inProgressTasks > 0) {
          status = StageStatus.IN_PROGRESS;
        } else {
          status = StageStatus.ASSIGNED;
        }
      }

      stageStatuses[stage] = {
        status,
        progressPercent,
        totalTasks,
        completedTasks,
        inProgressTasks,
        onHoldTasks,
        lastUpdated: new Date().toISOString(),
      };

      if (designStages.has(stage)) {
        totalDesignTasks += totalTasks;
        completedDesignTasks += completedTasks;
      } else {
        totalExecutionTasks += totalTasks;
        completedExecutionTasks += completedTasks;
      }
    });

    const totalProjectTasks = tasks.length;
    const totalCompletedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;

    const overallProgress =
      totalProjectTasks > 0
        ? Math.round((totalCompletedTasks / totalProjectTasks) * 100 * 100) / 100
        : 0;

    const designProgress =
      totalDesignTasks > 0
        ? Math.round((completedDesignTasks / totalDesignTasks) * 100 * 100) / 100
        : 0;

    const executionProgress =
      totalExecutionTasks > 0
        ? Math.round((completedExecutionTasks / totalExecutionTasks) * 100 * 100) / 100
        : 0;

    await this.repo.syncProjectStageProgress(
      organizationId,
      projectId,
      stageStatuses,
      {
        overallProgress,
        designProgress,
        executionProgress,
      }
    );

    return {
      stageStatuses,
      overallProgress,
      designProgress,
      executionProgress,
    };
  }
}

export const taskService = new TaskService();
