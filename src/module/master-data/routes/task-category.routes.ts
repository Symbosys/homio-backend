import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createTaskCategory,
  getTaskCategories,
  getTaskCategoryById,
  updateTaskCategory,
  deleteTaskCategory,
  toggleActiveTaskCategory,
} from "../controllers/task-category.controller.js";

const taskCategoryRoutes = Router();

// Protect all task category routes
taskCategoryRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/master-data/task-categories
 * @desc    Create a new task category for the organization
 */
taskCategoryRoutes.post("/", createTaskCategory);

/**
 * @route   GET /api/v1/master-data/task-categories
 * @desc    Fetch paginated list of task categories for the organization
 */
taskCategoryRoutes.get("/", getTaskCategories);

/**
 * @route   GET /api/v1/master-data/task-categories/:id
 * @desc    Fetch details of a single task category with usage count
 */
taskCategoryRoutes.get("/:id", getTaskCategoryById);

/**
 * @route   PATCH /api/v1/master-data/task-categories/:id
 * @desc    Update task category details
 */
taskCategoryRoutes.patch("/:id", updateTaskCategory);

/**
 * @route   PATCH /api/v1/master-data/task-categories/:id/toggle-active
 * @desc    Toggle active state of a task category
 */
taskCategoryRoutes.patch("/:id/toggle-active", toggleActiveTaskCategory);

/**
 * @route   DELETE /api/v1/master-data/task-categories/:id
 * @desc    Soft delete a task category
 */
taskCategoryRoutes.delete("/:id", deleteTaskCategory);

export default taskCategoryRoutes;
