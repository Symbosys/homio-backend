import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as leaveTypeController from "../controllers/leave-type.controller.js";

const router = Router();

// Protect all leave-type endpoints
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/leave-types
 * @desc    Create a new organizational leave policy type (e.g. Paid Leave, Sick Leave, Maternity)
 */
router.post("/", leaveTypeController.createLeaveType);

/**
 * @route   GET /api/v1/hrms/leave-types
 * @desc    Fetch list of active leave policy categories and yearly day quotas
 */
router.get("/", leaveTypeController.getLeaveTypes);

/**
 * @route   GET /api/v1/hrms/leave-types/:id
 * @desc    Get leave type details by ID
 */
router.get("/:id", leaveTypeController.getLeaveTypeById);

/**
 * @route   PATCH /api/v1/hrms/leave-types/:id
 * @desc    Update leave policy quota days, carry forward rules, and paid status
 */
router.patch("/:id", leaveTypeController.updateLeaveType);

/**
 * @route   DELETE /api/v1/hrms/leave-types/:id
 * @desc    Soft-delete leave policy type
 */
router.delete("/:id", leaveTypeController.deleteLeaveType);

export default router;
