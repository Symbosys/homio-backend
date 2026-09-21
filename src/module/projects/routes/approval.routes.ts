import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createApproval,
  getApprovals,
  getApprovalById,
  updateApproval,
  reviewApproval,
  deleteApproval,
  createChangeRequest,
  getChangeRequests,
  respondChangeRequest,
} from "../controllers/approval.controller.js";

const approvalRoutes = Router({ mergeParams: true });

// Protect all approval routes
approvalRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/approvals
 * @desc    Create a work approval item with drawings and milestone attribution
 */
approvalRoutes.post("/", createApproval);

/**
 * @route   GET /api/v1/projects/:projectId/approvals
 * @desc    Fetch paginated list of approvals with status, type, and milestone filters
 */
approvalRoutes.get("/", getApprovals);

/**
 * @route   GET /api/v1/projects/:projectId/approvals/:id
 * @desc    Fetch comprehensive details of a single approval with change request history
 */
approvalRoutes.get("/:id", getApprovalById);

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:id
 * @desc    Update work approval details and attachments
 */
approvalRoutes.patch("/:id", updateApproval);

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:id/review
 * @desc    Submit client approval decision (APPROVE / REJECT)
 */
approvalRoutes.patch("/:id/review", reviewApproval);

/**
 * @route   DELETE /api/v1/projects/:projectId/approvals/:id
 * @desc    Soft delete a work approval
 */
approvalRoutes.delete("/:id", deleteApproval);

// ==========================================
// CHANGE REQUESTS SUB-ROUTES
// ==========================================

/**
 * @route   POST /api/v1/projects/:projectId/approvals/:approvalId/change-requests
 * @desc    Client submits a change request round for a work approval
 */
approvalRoutes.post("/:approvalId/change-requests", createChangeRequest);

/**
 * @route   GET /api/v1/projects/:projectId/approvals/:approvalId/change-requests
 * @desc    List all change request rounds for a work approval
 */
approvalRoutes.get("/:approvalId/change-requests", getChangeRequests);

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:approvalId/change-requests/:id/respond
 * @desc    Organization responds to a change request (Accept / Reject / Implement)
 */
approvalRoutes.patch("/:approvalId/change-requests/:id/respond", respondChangeRequest);

export default approvalRoutes;
