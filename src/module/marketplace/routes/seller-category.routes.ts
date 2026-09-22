import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  registerSellerCategory,
  getSellerCategories,
  getSellerCategoryById,
  updateSellerCategoryCommission,
  removeSellerCategory,
} from "../controllers/seller-category.controller.js";

const router = Router();

/**
 * @route   GET /api/v1/marketplace/seller-categories
 * @desc    Fetch paginated list of seller category assignments with vertical and status filters
 * @access  Protected (Org Admin / Platform Admin)
 */
router.get("/", authenticate, authorize("ADMIN", "PLATFORM_ADMIN"), getSellerCategories);

/**
 * @route   GET /api/v1/marketplace/seller-categories/:id
 * @desc    Retrieve a single seller category assignment by ID
 * @access  Protected (Org Admin / Platform Admin)
 */
router.get("/:id", authenticate, authorize("ADMIN", "PLATFORM_ADMIN"), getSellerCategoryById);

/**
 * @route   POST /api/v1/marketplace/seller-categories
 * @desc    Register organization intent to sell in a master marketplace category (auto-approved)
 * @access  Protected (Org Admin)
 */
router.post("/", authenticate, authorize("ADMIN"), registerSellerCategory);

/**
 * @route   DELETE /api/v1/marketplace/seller-categories/:id
 * @desc    Deregister / remove seller category registration
 * @access  Protected (Org Admin)
 */
router.delete("/:id", authenticate, authorize("ADMIN"), removeSellerCategory);

/**
 * @route   PATCH /api/v1/marketplace/seller-categories/:id/commission
 * @desc    Platform Admin manually updates commission rate for an organization marketplace category
 * @access  Protected (Platform Admin only)
 */
router.patch("/:id/commission", authenticate, authorize("PLATFORM_ADMIN"), updateSellerCategoryCommission);

export default router;
