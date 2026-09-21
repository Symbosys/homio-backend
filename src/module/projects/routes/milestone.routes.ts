import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createMilestone,
  getMilestones,
  getMilestoneById,
  updateMilestone,
  toggleChecklistItem,
  deleteMilestone,
} from "../controllers/milestone.controller.js";

const milestoneRoutes = Router({ mergeParams: true });

// Protect all milestone routes
milestoneRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/milestones
 * @desc    Create a project milestone
 */
milestoneRoutes.post("/", createMilestone);

/**
 * @route   GET /api/v1/projects/:projectId/milestones
 * @desc    List all milestones for a project
 */
milestoneRoutes.get("/", getMilestones);

/**
 * @route   GET /api/v1/projects/:projectId/milestones/:id
 * @desc    Get single milestone by ID
 */
milestoneRoutes.get("/:id", getMilestoneById);

/**
 * @route   PATCH /api/v1/projects/:projectId/milestones/:id
 * @desc    Update milestone
 */
milestoneRoutes.patch("/:id", updateMilestone);

/**
 * @route   PATCH /api/v1/projects/:projectId/milestones/:milestoneId/checklists/:checklistId/toggle
 * @desc    Toggle checklist item completion
 */
milestoneRoutes.patch("/:milestoneId/checklists/:checklistId/toggle", toggleChecklistItem);

/**
 * @route   DELETE /api/v1/projects/:projectId/milestones/:id
 * @desc    Soft delete a milestone
 */
milestoneRoutes.delete("/:id", deleteMilestone);

export default milestoneRoutes;
