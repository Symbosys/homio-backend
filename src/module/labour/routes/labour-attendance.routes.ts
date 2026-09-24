import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  punchIn,
  punchOut,
  createManualAttendance,
  getAllAttendances,
  getAttendanceById,
  updateAttendance,
  approveAttendance,
  deleteAttendance,
} from "../controllers/labour-attendance.controller.js";

const router = Router();

// Protect all attendance endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/attendances/punch-in
 * @desc    Geofenced punch-in with live camera selfie
 */
router.post(
  "/attendances/punch-in",
  upload.single("punchInPhoto", { category: "image" }),
  punchIn
);

/**
 * @route   POST /api/v1/labour/attendances/:id/punch-out
 * @desc    Geofenced punch-out with live camera selfie
 */
router.post(
  "/attendances/:id/punch-out",
  upload.single("punchOutPhoto", { category: "image" }),
  punchOut
);

/**
 * @route   POST /api/v1/labour/attendances/manual
 * @desc    Manual attendance creation by supervisor
 */
router.post("/attendances/manual", createManualAttendance);

/**
 * @route   GET /api/v1/labour/attendances
 * @desc    Get paginated attendances with filters
 */
router.get("/attendances", getAllAttendances);

/**
 * @route   GET /api/v1/labour/attendances/:id
 * @desc    Get single attendance by ID
 * 
 * @route   PUT /api/v1/labour/attendances/:id
 * @desc    Full symmetric update
 * 
 * @route   DELETE /api/v1/labour/attendances/:id
 * @desc    Delete attendance
 */
router
  .route("/attendances/:id")
  .get(getAttendanceById)
  .put(updateAttendance)
  .delete(deleteAttendance);

/**
 * @route   PATCH /api/v1/labour/attendances/:id/approve
 * @desc    Supervisor approval sign-off
 */
router.patch("/attendances/:id/approve", approveAttendance);

export default router;
