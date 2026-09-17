import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = Router();

// Public Discovery
router.get("/", getCategories);
router.get("/tree", getCategoryTree);
router.get("/:id", getCategoryById);

// Platform Admin Management (Supports multipart image upload)
router.post("/", authenticate, authorize("PLATFORM_ADMIN"), upload.single("image"), createCategory);
router.put("/:id", authenticate, authorize("PLATFORM_ADMIN"), upload.single("image"), updateCategory);
router.delete("/:id", authenticate, authorize("PLATFORM_ADMIN"), deleteCategory);

export default router;
