import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createProjectService,
  getProjectServices,
  getProjectServiceById,
  updateProjectService,
  updateProjectServiceStatus,
  deleteProjectService,
} from "../controllers/project-service.controller.js";

const router = Router();

// Protect all project service endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/services
 * @desc    Create project service
 * 
 * @route   GET /api/v1/labour/services
 * @desc    Get paginated project services with filters
 */
router
  .route("/services")
  .post(createProjectService)
  .get(getProjectServices);

/**
 * @route   GET /api/v1/labour/services/:id
 * @desc    Get project service by ID
 * 
 * @route   PUT /api/v1/labour/services/:id
 * @desc    Update project service
 * 
 * @route   DELETE /api/v1/labour/services/:id
 * @desc    Soft delete project service
 */
router
  .route("/services/:id")
  .get(getProjectServiceById)
  .put(updateProjectService)
  .delete(deleteProjectService);

/**
 * @route   PATCH /api/v1/labour/services/:id/status
 * @desc    Update project service lifecycle status
 */
router.patch("/services/:id/status", updateProjectServiceStatus);

export default router;
