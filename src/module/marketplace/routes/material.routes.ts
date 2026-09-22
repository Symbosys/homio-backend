import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createMaterial,
  getMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  addMaterialVendorOffering,
  getMaterialVendorOfferings,
  getMaterialVendorOfferingById,
  updateMaterialVendorOffering,
  removeMaterialVendorOffering,
  setPrimaryMaterialVendorOffering,
} from "../controllers/material.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/marketplace/materials
 * @desc    Public catalog listing of wholesale and raw building materials with filters
 */
router.get("/", getMaterials);

/**
 * @route   GET /api/v1/marketplace/materials/:id
 * @desc    Get single material product details with all active vendor offerings
 */
router.get("/:id", getMaterialById);

/**
 * @route   POST /api/v1/marketplace/materials
 * @desc    Create a new material product with optional initial vendor offerings
 */
router.post("/", authenticate, authorize("ADMIN"), upload.single("coverImage"), createMaterial);

/**
 * @route   PUT /api/v1/marketplace/materials/:id
 * @desc    Update material product details
 */
router.put("/:id", authenticate, authorize("ADMIN"), upload.single("coverImage"), updateMaterial);

/**
 * @route   DELETE /api/v1/marketplace/materials/:id
 * @desc    Soft delete material product
 */
router.delete("/:id", authenticate, authorize("ADMIN"), deleteMaterial);

// ===========================================================================
// MULTI-VENDOR MATERIAL OFFERINGS ROUTES
// ===========================================================================

/**
 * @route   POST /api/v1/marketplace/materials/:productId/vendors
 * @desc    Attach a new vendor offering / supplier to a Material product
 */
router.post("/:productId/vendors", authenticate, authorize("ADMIN"), addMaterialVendorOffering);

/**
 * @route   GET /api/v1/marketplace/materials/:productId/vendors
 * @desc    List all vendor offerings / supplier mappings for a Material product
 */
router.get("/:productId/vendors", authenticate, authorize("ADMIN"), getMaterialVendorOfferings);

/**
 * @route   GET /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Retrieve single vendor offering details
 */
router.get("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), getMaterialVendorOfferingById);

/**
 * @route   PATCH /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Update a vendor offering (commission rate, pricing, stock, lead time)
 */
router.patch("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), updateMaterialVendorOffering);

/**
 * @route   DELETE /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Detach / remove vendor offering from a Material product
 */
router.delete("/:productId/vendors/:vendorOfferingId", authenticate, authorize("ADMIN"), removeMaterialVendorOffering);

/**
 * @route   PATCH /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId/primary
 * @desc    Set vendor offering as the primary supplier for a Material product
 */
router.patch("/:productId/vendors/:vendorOfferingId/primary", authenticate, authorize("ADMIN"), setPrimaryMaterialVendorOffering);

export default router;
