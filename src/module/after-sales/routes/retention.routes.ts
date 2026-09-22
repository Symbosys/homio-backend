import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createFollowUp,
  getFollowUps,
  getFollowUpById,
  updateFollowUp,
  logCall,
  deleteFollowUp,
} from "../controllers/retention.controller.js";

const retentionRoutes = Router({ mergeParams: true });

retentionRoutes.use(authenticate);

/**
 * @route   POST /api/v1/after-sales/retentions
 * @desc    Schedule a proactive retention follow-up call
 */
retentionRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  createFollowUp
);

/**
 * @route   GET /api/v1/after-sales/retentions
 * @desc    List retention follow-ups with filters & pagination
 */
retentionRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getFollowUps
);

/**
 * @route   GET /api/v1/after-sales/retentions/:id
 * @desc    Get single retention follow-up details
 */
retentionRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getFollowUpById
);

/**
 * @route   PATCH /api/v1/after-sales/retentions/:id
 * @desc    Partial update retention follow-up details
 */
retentionRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  updateFollowUp
);

/**
 * @route   POST /api/v1/after-sales/retentions/:id/log-call
 * @desc    Log conducted call outcome, CSAT score & referral lead
 */
retentionRoutes.post(
  "/:id/log-call",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  logCall
);

/**
 * @route   DELETE /api/v1/after-sales/retentions/:id
 * @desc    Soft delete retention follow-up
 */
retentionRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteFollowUp
);

export default retentionRoutes;
