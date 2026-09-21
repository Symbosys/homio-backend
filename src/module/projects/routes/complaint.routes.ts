import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  updateComplaintStatus,
  deleteComplaint,
  addComplaintComment,
  getComplaintComments,
} from "../controllers/complaint.controller.js";

const complaintRoutes = Router({ mergeParams: true });

// Protect all complaint routes
complaintRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/complaints
 * @desc    File a new project complaint / snag ticket
 */
complaintRoutes.post("/", createComplaint);

/**
 * @route   GET /api/v1/projects/:projectId/complaints
 * @desc    Fetch paginated list of complaints with search, severity, and status filters
 */
complaintRoutes.get("/", getComplaints);

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:id
 * @desc    Fetch comprehensive details of a single complaint with comments
 */
complaintRoutes.get("/:id", getComplaintById);

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/:id
 * @desc    Update complaint details, room, and target resolution date
 */
complaintRoutes.patch("/:id", updateComplaint);

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/:id/status
 * @desc    Update complaint status (RESOLVED, CLOSED, etc.) with resolution notes
 */
complaintRoutes.patch("/:id/status", updateComplaintStatus);

/**
 * @route   DELETE /api/v1/projects/:projectId/complaints/:id
 * @desc    Soft delete a complaint
 */
complaintRoutes.delete("/:id", deleteComplaint);

// ==========================================
// COMPLAINT COMMENTS SUB-ROUTES
// ==========================================

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/comments
 * @desc    Add a comment / activity update to a complaint
 */
complaintRoutes.post("/:complaintId/comments", addComplaintComment);

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:complaintId/comments
 * @desc    Get all comments for a complaint
 */
complaintRoutes.get("/:complaintId/comments", getComplaintComments);

export default complaintRoutes;
