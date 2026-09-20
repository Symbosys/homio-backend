import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as leaveRequestController from "../controllers/leave-request.controller.js";

const router = Router();

// Protect all leave-request endpoints
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/leaves/apply
 * @desc    Submit new employee leave application with medical/document proof attachments
 */
router.post(
  "/apply",
  upload.array("documents", 5, { category: "document" }),
  leaveRequestController.applyLeave
);

/**
 * @route   GET /api/v1/hrms/leaves/my-leaves
 * @desc    Fetch authenticated employee's personal leave request history
 */
router.get("/my-leaves", leaveRequestController.getMyLeaves);

/**
 * @route   GET /api/v1/hrms/leaves/my-balance
 * @desc    Fetch authenticated employee's remaining and consumed leave quota balance
 */
router.get("/my-balance", leaveRequestController.getMyLeaveBalance);

/**
 * @route   GET /api/v1/hrms/leaves/employee-balance/:employeeId
 * @desc    Fetch leave quota balance for specific employee
 */
router.get("/employee-balance/:employeeId", leaveRequestController.getEmployeeLeaveBalance);

/**
 * @route   GET /api/v1/hrms/leaves
 * @desc    Fetch paginated list of all employee leave applications with status and date filters
 */
router.get("/", leaveRequestController.getAllLeaveRequests);

/**
 * @route   GET /api/v1/hrms/leaves/:id
 * @desc    Get detailed leave application record by ID including medical attachments
 */
router.get("/:id", leaveRequestController.getLeaveRequestById);

/**
 * @route   PATCH /api/v1/hrms/leaves/:id/approve
 * @desc    Approve pending leave request and deduct quota days
 */
router.patch("/:id/approve", leaveRequestController.approveLeave);

/**
 * @route   PATCH /api/v1/hrms/leaves/:id/reject
 * @desc    Reject leave request with mandatory rejection reason
 */
router.patch("/:id/reject", leaveRequestController.rejectLeave);

/**
 * @route   PATCH /api/v1/hrms/leaves/:id/cancel
 * @desc    Cancel applied leave request and restore quota balance
 */
router.patch("/:id/cancel", leaveRequestController.cancelLeave);

export default router;
