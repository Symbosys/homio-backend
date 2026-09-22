import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createVisit,
  getVisits,
  getVisitById,
  updateVisit,
  checkInVisit,
  submitWorkReport,
  signOffVisit,
  updateVisitStatus,
  deleteVisit,
} from "../controllers/service-visit.controller.js";

const serviceVisitRoutes = Router({ mergeParams: true });

serviceVisitRoutes.use(authenticate);

const checkInUpload = upload.fields(
  [{ name: "checkInPhoto", maxCount: 1 }],
  { category: "all" }
);

const workReportUpload = upload.fields(
  [
    { name: "beforePhotos", maxCount: 5 },
    { name: "afterPhotos", maxCount: 5 },
  ],
  { category: "all" }
);

const signOffUpload = upload.fields(
  [{ name: "signature", maxCount: 1 }],
  { category: "all" }
);

/**
 * @route   POST /api/v1/after-sales/visits
 * @desc    Schedule technician service visit
 */
serviceVisitRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  createVisit
);

/**
 * @route   GET /api/v1/after-sales/visits
 * @desc    List service visits with filters & pagination
 */
serviceVisitRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getVisits
);

/**
 * @route   GET /api/v1/after-sales/visits/:id
 * @desc    Get detailed service visit docket with telemetry & proof photos
 */
serviceVisitRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getVisitById
);

/**
 * @route   PATCH /api/v1/after-sales/visits/:id
 * @desc    Partial update visit details
 */
serviceVisitRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  updateVisit
);

/**
 * @route   POST /api/v1/after-sales/visits/:id/check-in
 * @desc    Technician mobile check-in with GPS coordinates & selfie/site photo
 */
serviceVisitRoutes.post(
  "/:id/check-in",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  checkInUpload,
  checkInVisit
);

/**
 * @route   PATCH /api/v1/after-sales/visits/:id/work-report
 * @desc    Submit field work report with before/after photos
 */
serviceVisitRoutes.patch(
  "/:id/work-report",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  workReportUpload,
  submitWorkReport
);

/**
 * @route   POST /api/v1/after-sales/visits/:id/sign-off
 * @desc    Client digital touch signature & on-site CSAT rating
 */
serviceVisitRoutes.post(
  "/:id/sign-off",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  signOffUpload,
  signOffVisit
);

/**
 * @route   PATCH /api/v1/after-sales/visits/:id/status
 * @desc    Transition service visit lifecycle status
 */
serviceVisitRoutes.patch(
  "/:id/status",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  updateVisitStatus
);

/**
 * @route   DELETE /api/v1/after-sales/visits/:id
 * @desc    Soft delete service visit
 */
serviceVisitRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteVisit
);

export default serviceVisitRoutes;
