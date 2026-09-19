import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as attendanceController from "../controllers/attendance.controller.js";

const router = Router();

// Protect all attendance endpoints
router.use(authenticate);

// Punch In & Out (Live Facial Selfie with GPS)
router.post(
  "/punch-in",
  upload.single("photo", { category: "image" }),
  attendanceController.punchIn
);

router.post(
  "/punch-out",
  upload.single("photo", { category: "image" }),
  attendanceController.punchOut
);

// Employee Daily & History Endpoints
router.get("/today-status", attendanceController.getTodayStatus);
router.get("/my-history", attendanceController.getMyAttendance);

// Admin / Organization Analytics & Management Endpoints
router.get("/daily-summary", attendanceController.getDailySummary);
router.get("/", attendanceController.getAllAttendances);
router.get("/:id", attendanceController.getAttendanceById);
router.patch("/:id/regularize", attendanceController.regularizeAttendance);

export default router;
