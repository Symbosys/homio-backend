import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createPdfAsset,
  getPdfAssets,
  getPdfAssetsSummary,
  getPdfAssetById,
  updatePdfAsset,
  deletePdfAsset,
  toggleActivePdfAsset,
  reorderPdfAssets,
} from "../controllers/quotation-pdf-asset.controller.js";

const router = Router();

// Apply authentication middleware to all PDF asset routes
router.use(authenticate);

/**
 * @route   POST /api/v1/quotation-master/pdf-assets
 * @desc    Upload & create a new PDF page asset (Max 10 Front / 10 Back images per tenant)
 * @access  Private (Authenticated Tenant User)
 */
router.post("/", upload.single("image", { category: "image" }), createPdfAsset);

/**
 * @route   GET /api/v1/quotation-master/pdf-assets
 * @desc    Fetch all non-paginated PDF page assets for the tenant
 * @access  Private (Authenticated Tenant User)
 */
router.get("/", getPdfAssets);

/**
 * @route   GET /api/v1/quotation-master/pdf-assets/summary
 * @desc    Fetch quota usage summary (Front / Back counts vs 10 limit)
 * @access  Private (Authenticated Tenant User)
 */
router.get("/summary", getPdfAssetsSummary);

/**
 * @route   POST /api/v1/quotation-master/pdf-assets/reorder
 * @desc    Batch reorder PDF page assets within FRONT or BACK position
 * @access  Private (Authenticated Tenant User)
 */
router.post("/reorder", reorderPdfAssets);

/**
 * @route   GET /api/v1/quotation-master/pdf-assets/:id
 * @desc    Fetch single PDF page asset by ID
 * @access  Private (Authenticated Tenant User)
 */
router.get("/:id", getPdfAssetById);

/**
 * @route   PATCH /api/v1/quotation-master/pdf-assets/:id
 * @desc    Update PDF page asset metadata (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id", updatePdfAsset);

/**
 * @route   DELETE /api/v1/quotation-master/pdf-assets/:id
 * @desc    Soft delete a PDF page asset and clean up storage
 * @access  Private (Authenticated Tenant User)
 */
router.delete("/:id", deletePdfAsset);

/**
 * @route   PATCH /api/v1/quotation-master/pdf-assets/:id/toggle-active
 * @desc    Toggle active state of a PDF page asset
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/toggle-active", toggleActivePdfAsset);

export default router;
