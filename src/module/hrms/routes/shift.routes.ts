import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as shiftController from "../controllers/shift.controller.js";

const router = Router();

// Protect all shift endpoints
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/shifts
 * @desc    Create a new organizational working shift (timings, grace period, half day rule)
 */
router.post("/", shiftController.createShift);

/**
 * @route   GET /api/v1/hrms/shifts
 * @desc    Fetch paginated list of defined shifts
 */
router.get("/", shiftController.getShifts);

/**
 * @route   GET /api/v1/hrms/shifts/:id
 * @desc    Get shift configuration and assigned employees by ID
 */
router.get("/:id", shiftController.getShiftById);

/**
 * @route   PATCH /api/v1/hrms/shifts/:id
 * @desc    Update shift start/end times and break configurations
 */
router.patch("/:id", shiftController.updateShift);

/**
 * @route   DELETE /api/v1/hrms/shifts/:id
 * @desc    Soft-delete shift configuration
 */
router.delete("/:id", shiftController.deleteShift);

/**
 * @route   POST /api/v1/hrms/shifts/:id/assign-employees
 * @desc    Assign multiple employees to shift roster
 */
router.post("/:id/assign-employees", shiftController.assignEmployees);

/**
 * @route   POST /api/v1/hrms/shifts/unassign-employee/:employeeId
 * @desc    Unassign an employee from shift roster
 */
router.post("/unassign-employee/:employeeId", shiftController.unassignEmployee);

export default router;
