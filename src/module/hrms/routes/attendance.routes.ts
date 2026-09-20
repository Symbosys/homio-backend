import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as attendanceController from "../controllers/attendance.controller.js";

const router = Router();

// Protect all attendance endpoints
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/attendances/punch-in
 * @desc    Submit clock-in attendance punch with GPS coordinates and live verification photo
 */
router.post(
  "/punch-in",
  upload.single("photo", { category: "image" }),
  attendanceController.punchIn
);

/**
 * @route   POST /api/v1/hrms/attendances/punch-out
 * @desc    Submit clock-out attendance punch with GPS coordinates and live verification photo
 */
router.post(
  "/punch-out",
  upload.single("photo", { category: "image" }),
  attendanceController.punchOut
);

/**
 * @route   GET /api/v1/hrms/attendances/today-status
 * @desc    Fetch logged-in employee's real-time punch status for the current date
 */
router.get("/today-status", attendanceController.getTodayStatus);

/**
 * @route   GET /api/v1/hrms/attendances/my-history
 * @desc    Fetch authenticated employee's personal attendance history with monthly calendar breakdown
 */
router.get("/my-history", attendanceController.getMyAttendance);

/**
 * @route   GET /api/v1/hrms/attendances/daily-summary
 * @desc    Get organization-wide daily attendance KPI summary (present, late, absent, on-leave)
 */
router.get("/daily-summary", attendanceController.getDailySummary);

/**
 * @route   GET /api/v1/hrms/attendances
 * @desc    Fetch paginated list of all organization employee attendance logs with date and department filters
 */
router.get("/", attendanceController.getAllAttendances);

/**
 * @route   GET /api/v1/hrms/attendances/:id
 * @desc    Get single attendance record details by ID including GPS location and selfie proof
 */
router.get("/:id", attendanceController.getAttendanceById);

/**
 * @route   PATCH /api/v1/hrms/attendances/:id/regularize
 * @desc    Regularize / adjust employee punch timestamps and override status with audit note
 */
router.patch("/:id/regularize", attendanceController.regularizeAttendance);

export default router;
