import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createClaim,
  getClaims,
  getClaimById,
  updateClaim,
  reviewClaim,
  spawnServiceRequest,
  deleteClaim,
} from "../controllers/claim.controller.js";

const claimRoutes = Router({ mergeParams: true });

claimRoutes.use(authenticate);

const claimUpload = upload.fields(
  [{ name: "evidencePhotos", maxCount: 5 }],
  { category: "all" }
);

/**
 * @route   POST /api/v1/after-sales/claims
 * @desc    File a new warranty claim with evidence photos
 */
claimRoutes.post(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  claimUpload,
  createClaim
);

/**
 * @route   GET /api/v1/after-sales/claims
 * @desc    List warranty claims with filters & pagination
 */
claimRoutes.get(
  "/",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getClaims
);

/**
 * @route   GET /api/v1/after-sales/claims/:id
 * @desc    Get single claim record by ID
 */
claimRoutes.get(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getClaimById
);

/**
 * @route   PATCH /api/v1/after-sales/claims/:id
 * @desc    Update warranty claim details & additional evidence photos
 */
claimRoutes.patch(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  claimUpload,
  updateClaim
);

/**
 * @route   PATCH /api/v1/after-sales/claims/:id/review
 * @desc    Review warranty claim (Approve / Reject)
 */
claimRoutes.patch(
  "/:id/review",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  reviewClaim
);

/**
 * @route   POST /api/v1/after-sales/claims/:id/spawn-service-request
 * @desc    Convert an approved claim to a Service Request ticket
 */
claimRoutes.post(
  "/:id/spawn-service-request",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  spawnServiceRequest
);

/**
 * @route   DELETE /api/v1/after-sales/claims/:id
 * @desc    Soft delete warranty claim
 */
claimRoutes.delete(
  "/:id",
  authorize("PLATFORM_ADMIN", "ADMIN"),
  deleteClaim
);

export default claimRoutes;
