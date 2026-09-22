import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createVendorQuotation,
  getVendorQuotations,
  getVendorQuotationById,
  compareQuotations,
  updateVendorQuotation,
  deleteVendorQuotation,
  updateVendorQuotationStatus,
  addQuotationItem,
  updateQuotationItem,
  removeQuotationItem,
} from "../controllers/vendor-quotation.controller.js";

const router = Router();

// Apply auth to all procurement quotation routes
router.use(authenticate);

/**
 * @route   GET /api/v1/procurement/vendor-quotations/compare
 * @desc    Compare quotations side-by-side for a specific RFQ
 * @access  Private
 */
router.get("/compare", compareQuotations);

/**
 * @route   POST /api/v1/procurement/vendor-quotations
 * @desc    Create/record a vendor quote or bid for a project / RFQ
 * @access  Private
 */
router.post("/", upload.single("attachment"), createVendorQuotation);

/**
 * @route   GET /api/v1/procurement/vendor-quotations
 * @desc    Fetch paginated list of vendor quotations with filters
 * @access  Private
 */
router.get("/", getVendorQuotations);

/**
 * @route   GET /api/v1/procurement/vendor-quotations/:id
 * @desc    Fetch single quotation details including line items and vendor info
 * @access  Private
 */
router.get("/:id", getVendorQuotationById);

/**
 * @route   PATCH /api/v1/procurement/vendor-quotations/:id
 * @desc    Update quotation header details
 * @access  Private
 */
router.patch("/:id", upload.single("attachment"), updateVendorQuotation);

/**
 * @route   DELETE /api/v1/procurement/vendor-quotations/:id
 * @desc    Soft-delete a quotation
 * @access  Private
 */
router.delete("/:id", deleteVendorQuotation);

/**
 * @route   PATCH /api/v1/procurement/vendor-quotations/:id/status
 * @desc    Transition quotation status (e.g. ACCEPTED, REJECTED, SHORTLISTED)
 * @access  Private
 */
router.patch("/:id/status", updateVendorQuotationStatus);

// ==========================================
// Quotation Items
// ==========================================

/**
 * @route   POST /api/v1/procurement/vendor-quotations/:id/items
 * @desc    Add a line item to a quotation
 * @access  Private
 */
router.post("/:id/items", addQuotationItem);

/**
 * @route   PATCH /api/v1/procurement/vendor-quotations/:quotationId/items/:itemId
 * @desc    Update a line item in a quotation
 * @access  Private
 */
router.patch("/:quotationId/items/:itemId", updateQuotationItem);

/**
 * @route   DELETE /api/v1/procurement/vendor-quotations/:quotationId/items/:itemId
 * @desc    Remove a line item from a quotation
 * @access  Private
 */
router.delete("/:quotationId/items/:itemId", removeQuotationItem);

export default router;
