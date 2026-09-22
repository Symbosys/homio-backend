import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createHomeDecor,
  getHomeDecor,
  getHomeDecorById,
  updateHomeDecor,
  deleteHomeDecor,
  addHomeDecorVendorOffering,
  getHomeDecorVendorOfferings,
  getHomeDecorVendorOfferingById,
  updateHomeDecorVendorOffering,
  removeHomeDecorVendorOffering,
  setPrimaryHomeDecorVendorOffering,
} from "../controllers/home-decor.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/marketplace/home-decor
 * @desc    Public catalog listing with category, room, price, and vendor filters
 */
router.get("/", getHomeDecor);

/**
 * @route   GET /api/v1/marketplace/home-decor/:id
 * @desc    Get single product details with all active vendor offerings
 */
router.get("/:id", getHomeDecorById);

/**
 * @route   POST /api/v1/marketplace/home-decor
 * @desc    Create a new home decor product with optional initial vendor offerings
 */
router.post("/", authenticate, authorize("ADMIN"), upload.single("coverImage"), createHomeDecor);

/**
 * @route   PUT /api/v1/marketplace/home-decor/:id
 * @desc    Update home decor product details
 */
router.put("/:id", authenticate, authorize("ADMIN"), upload.single("coverImage"), updateHomeDecor);

/**
 * @route   DELETE /api/v1/marketplace/home-decor/:id
 * @desc    Soft delete home decor product
 */
router.delete("/:id", authenticate, authorize("ADMIN"), deleteHomeDecor);

// ===========================================================================
// MULTI-VENDOR PRODUCT OFFERINGS ROUTES
// ===========================================================================

/**
 * @route   POST /api/v1/marketplace/home-decor/:productId/vendors
 * @desc    Attach a new vendor offering / supplier to a Home Decor product
 */
router.post("/:productId/vendors", authenticate, authorize("ADMIN"), addHomeDecorVendorOffering);

/**
 * @route   GET /api/v1/marketplace/home-decor/:productId/vendors
 * @desc    List all vendor offerings / supplier mappings for a product
 */
router.get("/:productId/vendors", authenticate, authorize("ADMIN"), getHomeDecorVendorOfferings);

/**
 * @route   GET /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Retrieve single vendor offering details
 */
router.get("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), getHomeDecorVendorOfferingById);

/**
 * @route   PATCH /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Update a vendor offering (commission rate, pricing, stock, lead time)
 */
router.patch("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), updateHomeDecorVendorOffering);

/**
 * @route   DELETE /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Detach / remove vendor offering from a Home Decor product
 */
router.delete("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), removeHomeDecorVendorOffering);

/**
 * @route   PATCH /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId/primary
 * @desc    Set vendor offering as the primary supplier for a product
 */
router.patch("/:productId/vendors/:vendorOfferingId/primary", authenticate, authorize("ADMIN"), setPrimaryHomeDecorVendorOffering);

export default router;
