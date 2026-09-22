import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  seedDefaultCategories,
} from "../controllers/category.controller.js";

const categoryRoutes = Router();

categoryRoutes.use(authenticate);

/**
 * @route   POST /api/v1/after-sales/categories
 * @desc    Create a custom service category
 */
categoryRoutes.post("/", authorize("PLATFORM_ADMIN", "ADMIN"), createCategory);

/**
 * @route   GET /api/v1/after-sales/categories
 * @desc    List service categories
 */
categoryRoutes.get("/", authorize("PLATFORM_ADMIN", "ADMIN", "USER"), getCategories);

/**
 * @route   POST /api/v1/after-sales/categories/seed-defaults
 * @desc    Seed standard default service categories
 */
categoryRoutes.post("/seed-defaults", authorize("PLATFORM_ADMIN", "ADMIN"), seedDefaultCategories);

/**
 * @route   GET /api/v1/after-sales/categories/:id
 * @desc    Get service category by ID
 */
categoryRoutes.get("/:id", authorize("PLATFORM_ADMIN", "ADMIN", "USER"), getCategoryById);

/**
 * @route   PATCH /api/v1/after-sales/categories/:id
 * @desc    Update service category (dirty fields)
 */
categoryRoutes.patch("/:id", authorize("PLATFORM_ADMIN", "ADMIN"), updateCategory);

/**
 * @route   PATCH /api/v1/after-sales/categories/:id/toggle-status
 * @desc    Toggle category active status
 */
categoryRoutes.patch("/:id/toggle-status", authorize("PLATFORM_ADMIN", "ADMIN"), toggleCategoryStatus);

/**
 * @route   DELETE /api/v1/after-sales/categories/:id
 * @desc    Soft delete service category
 */
categoryRoutes.delete("/:id", authorize("PLATFORM_ADMIN", "ADMIN"), deleteCategory);

export default categoryRoutes;
