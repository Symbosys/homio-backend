import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createDesignFolder,
  getDesignFolders,
  getDesignFolderById,
  updateDesignFolder,
  deleteDesignFolder,
} from "../controllers/design.controller.js";

const designFolderRoutes = Router({ mergeParams: true });

// Protect all design folder routes with authentication
designFolderRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/design-folders
 * @desc    Create a new design folder (or nested room/stage sub-folder)
 */
designFolderRoutes.post("/", createDesignFolder);

/**
 * @route   GET /api/v1/projects/:projectId/design-folders
 * @desc    Fetch list of design folders (or recursive tree hierarchy) with room and stage filters
 */
designFolderRoutes.get("/", getDesignFolders);

/**
 * @route   GET /api/v1/projects/:projectId/design-folders/:id
 * @desc    Fetch single folder details with children and contained designs
 */
designFolderRoutes.get("/:id", getDesignFolderById);

/**
 * @route   PATCH /api/v1/projects/:projectId/design-folders/:id
 * @desc    Partial update of design folder metadata, stage, color, and budget
 */
designFolderRoutes.patch("/:id", updateDesignFolder);

/**
 * @route   DELETE /api/v1/projects/:projectId/design-folders/:id
 * @desc    Soft delete a design folder
 */
designFolderRoutes.delete("/:id", deleteDesignFolder);

export default designFolderRoutes;
