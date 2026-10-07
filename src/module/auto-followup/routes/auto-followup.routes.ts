import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  getOrganizationConfig,
  upsertOrganizationConfig,
  createFollowUpConfig,
  updateFollowUpConfig,
  getFollowUpConfigById,
  listFollowUpConfigs,
  deleteFollowUpConfig,
  listFollowUpEnrollments,
  getFollowUpEnrollmentById,
  cancelFollowUpEnrollment,
  enrollLeadManually,
  enrollMeetingManually,
  triggerBatchExecution,
} from "../controllers/auto-followup.controller.js";

const autoFollowUpRoutes = Router();

// Protect all follow-up routes
autoFollowUpRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/auto-followup/config
 * @desc    Fetch organization unified auto follow-up and reminder configuration
 */
autoFollowUpRoutes.get("/config", getOrganizationConfig);

/**
 * @route   PUT /api/v1/auto-followup/config
 * @desc    Upsert organization unified auto follow-up and reminder configuration
 */
autoFollowUpRoutes.put("/config", upsertOrganizationConfig);

/**
 * @route   PATCH /api/v1/auto-followup/config
 * @desc    Partially update organization unified auto follow-up and reminder configuration
 */
autoFollowUpRoutes.patch("/config", upsertOrganizationConfig);

/**
 * @route   POST /api/v1/auto-followup/configs
 * @desc    Create a new organization auto follow-up sequence configuration
 */
autoFollowUpRoutes.post("/configs", createFollowUpConfig);

/**
 * @route   GET /api/v1/auto-followup/configs
 * @desc    Fetch paginated list of follow-up configurations with type and active filters
 */
autoFollowUpRoutes.get("/configs", listFollowUpConfigs);

/**
 * @route   GET /api/v1/auto-followup/configs/:id
 * @desc    Get single follow-up configuration details by ID with nested steps
 */
autoFollowUpRoutes.get("/configs/:id", getFollowUpConfigById);

/**
 * @route   PATCH /api/v1/auto-followup/configs/:id
 * @desc    Update an existing follow-up configuration and its steps
 */
autoFollowUpRoutes.patch("/configs/:id", updateFollowUpConfig);

/**
 * @route   DELETE /api/v1/auto-followup/configs/:id
 * @desc    Delete a follow-up configuration and its step definitions
 */
autoFollowUpRoutes.delete("/configs/:id", deleteFollowUpConfig);

/**
 * @route   GET /api/v1/auto-followup/enrollments
 * @desc    Fetch paginated list of follow-up enrollments (Lead & Meeting)
 */
autoFollowUpRoutes.get("/enrollments", listFollowUpEnrollments);

/**
 * @route   GET /api/v1/auto-followup/enrollments/:id
 * @desc    Get enrollment details with complete execution history logs
 */
autoFollowUpRoutes.get("/enrollments/:id", getFollowUpEnrollmentById);

/**
 * @route   POST /api/v1/auto-followup/enrollments/:id/cancel
 * @desc    Cancel an active follow-up enrollment
 */
autoFollowUpRoutes.post("/enrollments/:id/cancel", cancelFollowUpEnrollment);

/**
 * @route   POST /api/v1/auto-followup/enroll/lead
 * @desc    Manually enroll a Lead into follow-up sequence
 */
autoFollowUpRoutes.post("/enroll/lead", enrollLeadManually);
autoFollowUpRoutes.post("/enrollments/lead", enrollLeadManually);

/**
 * @route   POST /api/v1/auto-followup/enroll/meeting
 * @desc    Manually enroll a Meeting into reminder sequence
 */
autoFollowUpRoutes.post("/enroll/meeting", enrollMeetingManually);
autoFollowUpRoutes.post("/enrollments/meeting", enrollMeetingManually);

/**
 * @route   POST /api/v1/auto-followup/process-due
 * @desc    Trigger execution batch for all due enrollments across the system
 */
autoFollowUpRoutes.post("/process-due", triggerBatchExecution);

export default autoFollowUpRoutes;
