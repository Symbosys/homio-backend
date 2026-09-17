import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  registerSellerCategory,
  getSellerCategories,
  getSellerCategoryById,
  approveSellerCategory,
  removeSellerCategory,
} from "../controllers/seller-category.controller.js";

const router = Router();

// Org Admin / Platform Admin viewing
router.get("/", authenticate, authorize("ADMIN", "PLATFORM_ADMIN"), getSellerCategories);
router.get("/:id", authenticate, authorize("ADMIN", "PLATFORM_ADMIN"), getSellerCategoryById);

// Org Admin registering intent
router.post("/", authenticate, authorize("ADMIN"), registerSellerCategory);
router.delete("/:id", authenticate, authorize("ADMIN"), removeSellerCategory);

// Platform Admin Approval & Commission assignment
router.patch("/:id/approval", authenticate, authorize("PLATFORM_ADMIN"), approveSellerCategory);

export default router;
