import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as organizationController from "../controllers/organization.controller.js";

const router = Router();

// Protect all platform organization endpoints with authenticate + authorize("PLATFORM_ADMIN")
router.use(authenticate, authorize("PLATFORM_ADMIN"));

// Onboard new organization with plan and initial admin user
router.post("/onboard", upload.single("logo"), organizationController.onboardOrganization);

// List all organizations (no pagination)
router.get("/", organizationController.getAllOrganizations);

// Get single organization by ID
router.get("/:id", organizationController.getOrganizationById);

// Update organization profile
router.patch("/:id", upload.single("logo"), organizationController.updateOrganization);

// Update organization status (suspend, activate, etc.)
router.patch("/:id/status", organizationController.updateOrganizationStatus);

// Assign or upgrade subscription plan for organization
router.post("/:id/subscription", organizationController.assignSubscription);

export default router;
