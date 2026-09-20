import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createLeadFollowUp,
  getLeadFollowUps,
  getLeadFollowUpById,
  updateLeadFollowUp,
  deleteLeadFollowUp,
} from "../controllers/lead-followup.controller.js";

const leadFollowUpRoutes = Router();

// Protect all lead follow-up routes
leadFollowUpRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/crm/follow-ups
 * @desc    Schedule a new follow-up interaction (CALL, SITE_VISIT, WHATSAPP, etc.) with a lead
 */
leadFollowUpRoutes.post("/", createLeadFollowUp);

/**
 * @route   GET /api/v1/crm/follow-ups
 * @desc    Fetch paginated list of follow-ups with date range, status, and lead filters
 */
leadFollowUpRoutes.get("/", getLeadFollowUps);

/**
 * @route   GET /api/v1/crm/follow-ups/:id
 * @desc    Get single follow-up details by ID
 */
leadFollowUpRoutes.get("/:id", getLeadFollowUpById);

/**
 * @route   PATCH /api/v1/crm/follow-ups/:id
 * @desc    Update follow-up outcome, mark as completed, or reschedule date/time
 */
leadFollowUpRoutes.patch("/:id", updateLeadFollowUp);

/**
 * @route   DELETE /api/v1/crm/follow-ups/:id
 * @desc    Delete scheduled follow-up entry
 */
leadFollowUpRoutes.delete("/:id", deleteLeadFollowUp);

export default leadFollowUpRoutes;
