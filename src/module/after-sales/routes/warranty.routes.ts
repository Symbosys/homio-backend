import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createWarranty,
  getWarranties,
  getWarrantyById,
  updateWarranty,
  updateWarrantyStatus,
  deleteWarranty,
} from "../controllers/warranty.controller.js";

const warrantyRoutes = Router({ mergeParams: true });

warrantyRoutes.use(authenticate);

const warrantyUpload = upload.fields(
  [{ name: "policyDoc", maxCount: 1 }],
  { category: "all" }
);

/**
 * @route   POST /api/v1/after-sales/warranties
 * @desc    Create a project warranty docket with policy document
 */
warrantyRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  warrantyUpload,
  createWarranty
);

/**
 * @route   GET /api/v1/after-sales/warranties
 * @desc    List project warranties with filters & pagination
 */
warrantyRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getWarranties
);

/**
 * @route   GET /api/v1/after-sales/warranties/:id
 * @desc    Get detailed warranty record with claims & requests
 */
warrantyRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getWarrantyById
);

/**
 * @route   PATCH /api/v1/after-sales/warranties/:id
 * @desc    Partial update warranty details & replace policy document
 */
warrantyRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  warrantyUpload,
  updateWarranty
);

/**
 * @route   PATCH /api/v1/after-sales/warranties/:id/status
 * @desc    Transition warranty status (ACTIVE, EXPIRED, CLAIMED, VOIDED)
 */
warrantyRoutes.patch(
  "/:id/status",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  updateWarrantyStatus
);

/**
 * @route   DELETE /api/v1/after-sales/warranties/:id
 * @desc    Soft delete project warranty
 */
warrantyRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteWarranty
);

export default warrantyRoutes;
