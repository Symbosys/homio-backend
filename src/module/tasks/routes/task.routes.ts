import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { taskController } from "../controllers/task.controller.js";

const taskRoutes = Router();

// Protect all task endpoints
taskRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/tasks
 * @desc    Create a new task (optionally linked to project and stage)
 */
taskRoutes.post("/", taskController.createTask);

/**
 * @route   GET /api/v1/tasks
 * @desc    Get paginated tasks with dynamic filters
 */
taskRoutes.get("/", taskController.getTasks);

/**
 * @route   GET /api/v1/tasks/projects/:projectId/stage-summary
 * @desc    Get project stage-wise task counts & progress metrics
 */
taskRoutes.get("/projects/:projectId/stage-summary", taskController.getProjectStageSummary);

/**
 * @route   GET /api/v1/tasks/:id
 * @desc    Get task details by ID
 */
taskRoutes.get("/:id", taskController.getTaskById);

/**
 * @route   PATCH /api/v1/tasks/:id
 * @desc    Update task details / stage / reviewer / assignees
 */
taskRoutes.patch("/:id", taskController.updateTask);

/**
 * @route   PATCH /api/v1/tasks/:id/status
 * @desc    Quick update status (e.g. COMPLETED, IN_PROGRESS, ON_HOLD)
 */
taskRoutes.patch("/:id/status", taskController.updateTaskStatus);

/**
 * @route   POST /api/v1/tasks/:id/submit-review
 * @desc    Submit task for reviewer evaluation (marks UNDER_REVIEW)
 */
taskRoutes.post("/:id/submit-review", taskController.submitForReview);

/**
 * @route   POST /api/v1/tasks/:id/review
 * @desc    Reviewer evaluation: Approve (COMPLETED) or Request Rework (RE_WORK)
 */
taskRoutes.post("/:id/review", taskController.reviewTaskDecision);

/**
 * @route   DELETE /api/v1/tasks/:id
 * @desc    Soft delete task
 */
taskRoutes.delete("/:id", taskController.deleteTask);

export default taskRoutes;
