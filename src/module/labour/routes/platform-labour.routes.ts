import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as platformLabourController from "../controllers/platform-labour.controller.js";

const router = Router();

// Protect all platform labour routes with authenticate + authorize("PLATFORM_ADMIN", "USER", "LABOUR")
router.use(authenticate, authorize("PLATFORM_ADMIN", "USER", "LABOUR"));

/**
 * @route   POST /api/v1/platform/labours
 * @desc    Platform Admin: Create a labour profile (platform-independent or tenant-assigned)
 */
router.post("/", upload.single("photo"), platformLabourController.createLabour);

/**
 * @route   GET /api/v1/platform/labours/bookings
 * @desc    Platform Admin / Labour / User: Fetch service bookings with channel filter (ORGANIZATION_PROJECT vs PLATFORM_MARKETPLACE) and full date/status filters
 */
router.get("/bookings", platformLabourController.getPlatformLabourBookings);

/**
 * @route   GET /api/v1/platform/labours/services
 * @desc    Alias for /bookings endpoint to fetch service bookings with filters
 */
router.get("/services", platformLabourController.getPlatformLabourBookings);

/**
 * @route   GET /api/v1/platform/labours
 * @desc    Platform Admin: Fetch labours with 3-way scoping (ALL, PLATFORM_ONLY, ORG_ONLY) and filters
 */
router.get("/", platformLabourController.getLabours);

/**
 * @route   GET /api/v1/platform/labours/:id
 * @desc    Platform Admin: Fetch single labour profile by UUID
 */
router.get("/:id", platformLabourController.getLabourById);

/**
 * @route   PATCH /api/v1/platform/labours/:id
 * @desc    Platform Admin: Update labour profile symmetrically
 */
router.patch("/:id", upload.single("photo"), platformLabourController.updateLabour);

/**
 * @route   DELETE /api/v1/platform/labours/:id
 * @desc    Platform Admin: Soft delete labour profile
 */
router.delete("/:id", platformLabourController.deleteLabour);

export default router;
