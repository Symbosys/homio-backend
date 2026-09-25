import { prisma } from "../../../lib/prisma.js";
import { taskRepo } from "../repos/task.repo.js";
import { leadRepo } from "../repos/lead.repo.js";
import { customerRepo } from "../repos/customer.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType, Prisma } from "../../../types/types.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  UpdateTaskPriorityInput,
  AddAssigneesInput,
  AddChecklistItemInput,
  UpdateChecklistItemInput,
  AddTaskActivityInput,
  UploadTaskDocumentInput,
  BulkActionTasksInput,
  GetTasksQueryInput,
  GetTaskKanbanQueryInput,
  SubmitTaskForReviewInput,
  ApproveTaskInput,
  RejectTaskForReworkInput,
  HoldTaskInput,
} from "../validators/task.validator.js";

export class TaskService {
  /**
   * Create a new task
   */
  async createTask(organizationId: string, input: CreateTaskInput, createdById?: string | null) {
    if (input.leadId) {
      const lead = await leadRepo.findById(input.leadId, organizationId);
      if (!lead) {
        throw new ErrorResponse("Associated lead not found", statusCode.Not_Found);
      }
    }

    const taskCode = await taskRepo.generateTaskCode(organizationId);

    const task = await taskRepo.create(organizationId, {
      ...input,
      taskCode,
      createdById,
    });

    // Record initial activity
    await taskRepo.addActivity(organizationId, task.id, {
      type: "NOTE",
      content: `Task created with priority ${input.priority || "MEDIUM"}`,
      performedById: null,
    });

    return task;
  }

  /**
   * Get paginated tasks
   */
  async getTasks(organizationId: string, query: GetTasksQueryInput) {
    return taskRepo.findAll(organizationId, query);
  }

  /**
   * Get Kanban board grouping
   */
  async getKanban(organizationId: string, query: GetTaskKanbanQueryInput) {
    return taskRepo.getKanban(organizationId, query);
  }

  /**
   * Get single task by ID
   */
  async getTaskById(id: string, organizationId: string) {
    const task = await taskRepo.findById(id, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }
    return task;
  }

  /**
   * Update task details
   */
  async updateTask(id: string, organizationId: string, input: UpdateTaskInput) {
    const existing = await taskRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    return taskRepo.update(id, organizationId, input);
  }

  /**
   * Update task status (e.g. dragging card on Kanban)
   */
  async updateTaskStatus(id: string, organizationId: string, input: UpdateTaskStatusInput, userId?: string | null) {
    const existing = await taskRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    if (existing.status === input.status) {
      return existing;
    }

    const isCompleted = input.status === "COMPLETED";
    const isUnderReview = input.status === "UNDER_REVIEW";

    const updated = await taskRepo.update(id, organizationId, {
      status: input.status,
      completedAt: isCompleted ? new Date().toISOString() : null,
      ...(isUnderReview ? { submittedForReviewAt: new Date() } : {}),
    });

    await taskRepo.addActivity(organizationId, id, {
      type: "STATUS_CHANGE",
      content: `Status changed from ${existing.status} to ${input.status}`,
      metadata: { fromStatus: existing.status, toStatus: input.status },
    });

    return updated;
  }

  /**
   * Submit task for review and verification
   */
  async submitForReview(organizationId: string, taskId: string, notes?: string | null, userId?: string | null) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updated = await taskRepo.submitForReview(taskId);

    await taskRepo.addActivity(organizationId, taskId, {
      type: "STATUS_CHANGE",
      content: notes ? `Task submitted under review: ${notes}` : "Task submitted under review and verification",
      metadata: { fromStatus: task.status, toStatus: "UNDER_REVIEW", notes },
    });

    return updated;
  }

  /**
   * Approve task and verify completion
   */
  async approveTask(
    organizationId: string,
    taskId: string,
    approvedById?: string | null,
    approvalRemarks?: string | null,
    userId?: string | null
  ) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    let resolvedApproverId = approvedById;
    if (!resolvedApproverId && userId) {
      const employee = await prisma.employee.findFirst({
        where: { userId, organizationId, isDeleted: false },
        select: { id: true },
      });
      if (employee) {
        resolvedApproverId = employee.id;
      }
    }

    const updated = await taskRepo.approveTask(taskId, resolvedApproverId, approvalRemarks);

    await taskRepo.addActivity(organizationId, taskId, {
      type: "STATUS_CHANGE",
      content: approvalRemarks
        ? `Task approved and verified: ${approvalRemarks}`
        : "Task verified, approved, and marked completed",
      metadata: {
        fromStatus: task.status,
        toStatus: "COMPLETED",
        approvedById: resolvedApproverId,
        approvalRemarks,
      },
    });

    return updated;
  }

  /**
   * Reject task and request rework
   */
  async rejectTaskForRework(
    organizationId: string,
    taskId: string,
    reworkNotes: string,
    userId?: string | null
  ) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updated = await taskRepo.rejectTaskForRework(taskId, reworkNotes);

    await taskRepo.addActivity(organizationId, taskId, {
      type: "STATUS_CHANGE",
      content: `Task rejected for rework: ${reworkNotes}`,
      metadata: { fromStatus: task.status, toStatus: "RE_WORK", reworkNotes },
    });

    return updated;
  }

  /**
   * Put task on hold
   */
  async holdTask(
    organizationId: string,
    taskId: string,
    reason: string,
    userId?: string | null
  ) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updated = await taskRepo.holdTask(taskId, reason);

    await taskRepo.addActivity(organizationId, taskId, {
      type: "STATUS_CHANGE",
      content: `Task placed on hold: ${reason}`,
      metadata: { fromStatus: task.status, toStatus: "ON_HOLD", reason },
    });

    return updated;
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(id: string, organizationId: string, input: UpdateTaskPriorityInput) {
    const existing = await taskRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updated = await taskRepo.update(id, organizationId, {
      priority: input.priority,
    });

    await taskRepo.addActivity(organizationId, id, {
      type: "PRIORITY_CHANGE",
      content: `Priority changed from ${existing.priority} to ${input.priority}`,
      metadata: { fromPriority: existing.priority, toPriority: input.priority },
    });

    return updated;
  }

  /**
   * Assignees operations
   */
  async addAssignees(organizationId: string, taskId: string, input: AddAssigneesInput, userId?: string | null) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const result = await taskRepo.addAssignees(organizationId, taskId, input.assignees, userId);

    await taskRepo.addActivity(organizationId, taskId, {
      type: "ASSIGNMENT",
      content: `Assigned ${input.assignees.length} employee(s) to task`,
    });

    return result;
  }

  async removeAssignee(organizationId: string, taskId: string, employeeId: string) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    await taskRepo.removeAssignee(taskId, employeeId);
    return { message: "Assignee removed successfully" };
  }

  async setPrimaryAssignee(organizationId: string, taskId: string, employeeId: string) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    return taskRepo.setPrimaryAssignee(taskId, employeeId);
  }

  /**
   * Checklist operations with automatic metric tracking (e.g. 2/10 completed)
   */
  async addChecklistItem(organizationId: string, taskId: string, input: AddChecklistItemInput) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const item = await taskRepo.addChecklistItem(organizationId, taskId, input);
    await taskRepo.recalculateChecklistMetrics(taskId);
    return item;
  }

  async updateChecklistItem(organizationId: string, taskId: string, itemId: string, input: UpdateChecklistItemInput) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const updated = await taskRepo.updateChecklistItem(itemId, input);
    await taskRepo.recalculateChecklistMetrics(taskId);
    return updated;
  }

  async deleteChecklistItem(organizationId: string, taskId: string, itemId: string) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    await taskRepo.deleteChecklistItem(itemId);
    await taskRepo.recalculateChecklistMetrics(taskId);
    return { message: "Checklist item deleted successfully" };
  }

  /**
   * Task Activity / Comments
   */
  async addActivity(organizationId: string, taskId: string, input: AddTaskActivityInput) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    return taskRepo.addActivity(organizationId, taskId, input);
  }

  async deleteActivity(organizationId: string, taskId: string, activityId: string) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    await taskRepo.deleteActivity(activityId);
    return { message: "Activity removed successfully" };
  }

  /**
   * Document Operations
   */
  async uploadDocument(
    organizationId: string,
    taskId: string,
    input: UploadTaskDocumentInput,
    file: Express.Multer.File,
    uploadedById?: string | null
  ) {
    const task = await taskRepo.findById(taskId, organizationId);
    if (!task) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/tasks/${taskId}/docs`,
        resourceType: "raw",
      }
    );

    const docFile: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };

    return taskRepo.createDocument({
      organizationId,
      taskId,
      name: input.name,
      fileUrl: docFile as unknown as Prisma.InputJsonValue,
      uploadedById,
    });
  }

  async deleteDocument(id: string, organizationId: string) {
    await taskRepo.deleteDocument(id);
    return { message: "Document deleted successfully" };
  }

  /**
   * Bulk actions
   */
  async bulkActions(organizationId: string, input: BulkActionTasksInput) {
    if (input.action === "UPDATE_STATUS" && input.status) {
      await taskRepo.bulkUpdateStatus(input.taskIds, organizationId, input.status);
      return { message: `${input.taskIds.length} task(s) updated to ${input.status}` };
    }

    if (input.action === "UPDATE_PRIORITY" && input.priority) {
      await taskRepo.bulkUpdatePriority(input.taskIds, organizationId, input.priority);
      return { message: `${input.taskIds.length} task(s) priority updated to ${input.priority}` };
    }

    if (input.action === "ASSIGN") {
      await taskRepo.bulkAssign(input.taskIds, organizationId, input.assignedToId || null);
      return { message: `${input.taskIds.length} task(s) assigned successfully` };
    }

    if (input.action === "DELETE") {
      await taskRepo.bulkDelete(input.taskIds, organizationId);
      return { message: `${input.taskIds.length} task(s) deleted successfully` };
    }

    throw new ErrorResponse("Invalid bulk action requested", statusCode.Bad_Request);
  }

  /**
   * Soft delete task
   */
  async deleteTask(id: string, organizationId: string) {
    const existing = await taskRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task not found", statusCode.Not_Found);
    }

    await taskRepo.softDelete(id, organizationId);
    return { message: "Task deleted successfully" };
  }
}

export const taskService = new TaskService();
