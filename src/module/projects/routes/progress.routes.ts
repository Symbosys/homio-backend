import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createProgress,
  getProgressList,
  getProgressById,
  updateProgress,
  reviewProgress,
  deleteProgress,
} from "../controllers/progress.controller.js";

const progressRoutes = Router({ mergeParams: true });

// Protect all site progress routes
progressRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/progress
 * @desc    Submit a daily site progress log
 */
progressRoutes.post("/", createProgress);

/**
 * @route   GET /api/v1/projects/:projectId/progress
 * @desc    List paginated site progress logs for a project
 */
progressRoutes.get("/", getProgressList);

/**
 * @route   GET /api/v1/projects/:projectId/progress/:id
 * @desc    Get single progress log details
 */
progressRoutes.get("/:id", getProgressById);

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/:id
 * @desc    Update progress log
 */
progressRoutes.patch("/:id", updateProgress);

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/:id/approval
 * @desc    Review and approve/reject site progress report
 */
progressRoutes.patch("/:id/approval", reviewProgress);

/**
 * @route   DELETE /api/v1/projects/:projectId/progress/:id
 * @desc    Soft delete a site progress entry
 */
progressRoutes.delete("/:id", deleteProgress);

export default progressRoutes;
