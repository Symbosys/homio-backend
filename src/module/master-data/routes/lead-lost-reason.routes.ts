import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createLeadLostReason,
  getLeadLostReasons,
  getLeadLostReasonById,
  updateLeadLostReason,
  deleteLeadLostReason,
  toggleActiveLeadLostReason,
} from "../controllers/lead-lost-reason.controller.js";

const leadLostReasonRoutes = Router();

// Protect all lead lost reason routes
leadLostReasonRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/master-data/lead-lost-reasons
 * @desc    Create a new lead lost reason for the organization
 */
leadLostReasonRoutes.post("/", createLeadLostReason);

/**
 * @route   GET /api/v1/master-data/lead-lost-reasons
 * @desc    Fetch paginated list of lead lost reasons for the organization
 */
leadLostReasonRoutes.get("/", getLeadLostReasons);

/**
 * @route   GET /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Fetch details of a single lead lost reason with usage count
 */
leadLostReasonRoutes.get("/:id", getLeadLostReasonById);

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Update lead lost reason details
 */
leadLostReasonRoutes.patch("/:id", updateLeadLostReason);

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id/toggle-active
 * @desc    Toggle active state of a lead lost reason
 */
leadLostReasonRoutes.patch("/:id/toggle-active", toggleActiveLeadLostReason);

/**
 * @route   DELETE /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Soft delete a lead lost reason
 */
leadLostReasonRoutes.delete("/:id", deleteLeadLostReason);

export default leadLostReasonRoutes;
