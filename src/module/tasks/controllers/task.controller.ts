import type { Request, Response } from "express";
import { taskService, TaskService } from "../services/task.service.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { prisma } from "../../../lib/prisma.js";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  submitTaskReviewSchema,
  reviewTaskDecisionSchema,
  getTasksQuerySchema,
  taskIdParamSchema,
  taskProjectIdParamSchema,
} from "../validators/task.validator.js";

/**
 * Controller handling task operations, reviewer decisions, and stage progress summaries
 */
export class TaskController {
  constructor(private readonly service: TaskService = taskService) {}

  /**
   * @route   POST /api/v1/tasks
   * @desc    Create a new task (optionally linked to a project and stage)
   */
  createTask = async (req: Request, res: Response) => {
    const validated = createTaskSchema.parse({ body: req.body });
    const organizationId = (req as any).user.organizationId;
    const createdById = (req as any).user.id;

    const task = await this.service.createTask(organizationId, validated.body, createdById);

    return SuccessResponse(res, "Task created successfully", task, statusCode.Created);
  };

  /**
   * @route   GET /api/v1/tasks
   * @desc    List tasks with dynamic filtering & pagination
   */
  getTasks = async (req: Request, res: Response) => {
    const validated = getTasksQuerySchema.parse({ query: req.query });
    const organizationId = (req as any).user.organizationId;

    const result = await this.service.getTasks(organizationId, validated.query);

    return SuccessResponse(res, "Tasks fetched successfully", result, statusCode.OK);
  };

  /**
   * @route   GET /api/v1/tasks/:id
   * @desc    Get single task details
   */
  getTaskById = async (req: Request, res: Response) => {
    const validated = taskIdParamSchema.parse({ params: req.params });
    const organizationId = (req as any).user.organizationId;

    const task = await this.service.getTaskById(organizationId, validated.params.id);

    return SuccessResponse(res, "Task details fetched successfully", task, statusCode.OK);
  };

  /**
   * @route   PATCH /api/v1/tasks/:id
   * @desc    Update task fields, assignees, or stage
   */
  updateTask = async (req: Request, res: Response) => {
    const validated = updateTaskSchema.parse({ params: req.params, body: req.body });
    const organizationId = (req as any).user.organizationId;

    const task = await this.service.updateTask(
      organizationId,
      validated.params.id,
      validated.body
    );

    return SuccessResponse(res, "Task updated successfully", task, statusCode.OK);
  };

  /**
   * @route   PATCH /api/v1/tasks/:id/status
   * @desc    Quick update status (e.g. TODO, IN_PROGRESS, COMPLETED)
   */
  updateTaskStatus = async (req: Request, res: Response) => {
    const validated = updateTaskStatusSchema.parse({ params: req.params, body: req.body });
    const organizationId = (req as any).user.organizationId;

    const task = await this.service.updateTaskStatus(
      organizationId,
      validated.params.id,
      validated.body.status,
      validated.body.remarks
    );

    return SuccessResponse(res, "Task status updated successfully", task, statusCode.OK);
  };

  /**
   * @route   POST /api/v1/tasks/:id/submit-review
   * @desc    Submit task for manager/reviewer review (marks UNDER_REVIEW)
   */
  submitForReview = async (req: Request, res: Response) => {
    const validated = submitTaskReviewSchema.parse({ params: req.params, body: req.body });
    const organizationId = (req as any).user.organizationId;

    const task = await this.service.submitForReview(
      organizationId,
      validated.params.id,
      validated.body?.remarks
    );

    return SuccessResponse(res, "Task submitted for review successfully", task, statusCode.OK);
  };

  /**
   * @route   POST /api/v1/tasks/:id/review
   * @desc    Reviewer decision: Approve (COMPLETED) or Request Rework (RE_WORK)
   */
  reviewTaskDecision = async (req: Request, res: Response) => {
    const validated = reviewTaskDecisionSchema.parse({ params: req.params, body: req.body });
    const organizationId = (req as any).user.organizationId;
    const userId = (req as any).user.id;

    const task = await this.service.reviewTaskDecision(
      organizationId,
      validated.params.id,
      validated.body,
      undefined,
      userId
    );

    return SuccessResponse(res, "Task review recorded successfully", task, statusCode.OK);
  };

  /**
   * @route   DELETE /api/v1/tasks/:id
   * @desc    Soft delete a task
   */
  deleteTask = async (req: Request, res: Response) => {
    const validated = taskIdParamSchema.parse({ params: req.params });
    const organizationId = (req as any).user.organizationId;

    const result = await this.service.deleteTask(organizationId, validated.params.id);

    return SuccessResponse(res, "Task deleted successfully", result, statusCode.OK);
  };

  /**
   * @route   GET /api/v1/tasks/projects/:projectId/stage-summary
   * @desc    Fetch stage-wise completion and progress breakdown for a project
   */
  getProjectStageSummary = async (req: Request, res: Response) => {
    const validated = taskProjectIdParamSchema.parse({ params: req.params });
    const organizationId = (req as any).user.organizationId;

    const summary = await this.service.getProjectStageSummary(
      organizationId,
      validated.params.projectId
    );

    return SuccessResponse(res, "Project stage task summary fetched successfully", summary, statusCode.OK);
  };
}

export const taskController = new TaskController();
