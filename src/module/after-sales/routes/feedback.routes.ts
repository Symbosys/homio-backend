import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createFeedback,
  getFeedbacks,
  getFeedbackById,
  updateFeedback,
  escalateFeedback,
  resolveEscalation,
  deleteFeedback,
} from "../controllers/feedback.controller.js";

const feedbackRoutes = Router({ mergeParams: true });

feedbackRoutes.use(authenticate);

/**
 * @route   POST /api/v1/after-sales/feedbacks
 * @desc    Submit customer feedback & 5-pillar CSAT ratings
 */
feedbackRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  createFeedback
);

/**
 * @route   GET /api/v1/after-sales/feedbacks
 * @desc    List customer feedbacks with filters & pagination
 */
feedbackRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getFeedbacks
);

/**
 * @route   GET /api/v1/after-sales/feedbacks/:id
 * @desc    Get single customer feedback details
 */
feedbackRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getFeedbackById
);

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id
 * @desc    Update customer feedback details
 */
feedbackRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  updateFeedback
);

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id/escalate
 * @desc    Escalate low rating or customer complaint to management
 */
feedbackRoutes.patch(
  "/:id/escalate",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  escalateFeedback
);

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id/resolve-escalation
 * @desc    Manager adds notes and marks escalation resolved
 */
feedbackRoutes.patch(
  "/:id/resolve-escalation",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  resolveEscalation
);

/**
 * @route   DELETE /api/v1/after-sales/feedbacks/:id
 * @desc    Soft delete customer feedback
 */
feedbackRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteFeedback
);

export default feedbackRoutes;
