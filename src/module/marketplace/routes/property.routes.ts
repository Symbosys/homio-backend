import { Router } from "express";
import {
  authenticate,
  authorize,
} from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  updatePropertyVerification,
  deleteProperty,
} from "../controllers/property.controller.js";

const router = Router();

// Public Property Discovery (supports ?organizationId=... and filters)
router.get("/", getProperties);
router.get("/:id", getPropertyById);

// Protected Org Admin Listing Management
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  upload.single("coverImage"),
  createProperty,
);
router.put(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  upload.single("coverImage"),
  updateProperty,
);
router.delete("/:id", authenticate, authorize("ADMIN"), deleteProperty);

// Platform Admin Homio Verification
router.patch(
  "/:id/verification",
  authenticate,
  authorize("PLATFORM_ADMIN"),
  updatePropertyVerification,
);

export default router;
