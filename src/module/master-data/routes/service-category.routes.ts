import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createServiceCategory,
  getServiceCategories,
  getServiceCategoryById,
  updateServiceCategory,
  deleteServiceCategory,
  toggleActiveServiceCategory,
} from "../controllers/service-category.controller.js";

const serviceCategoryRoutes = Router();

// Protect all service category routes
serviceCategoryRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/master-data/service-categories
 * @desc    Create a new service category for the organization
 */
serviceCategoryRoutes.post("/", createServiceCategory);

/**
 * @route   GET /api/v1/master-data/service-categories
 * @desc    Fetch paginated list of service categories for the organization
 */
serviceCategoryRoutes.get("/", getServiceCategories);

/**
 * @route   GET /api/v1/master-data/service-categories/:id
 * @desc    Fetch details of a single service category with cross-module usage counts
 */
serviceCategoryRoutes.get("/:id", getServiceCategoryById);

/**
 * @route   PATCH /api/v1/master-data/service-categories/:id
 * @desc    Update service category details
 */
serviceCategoryRoutes.patch("/:id", updateServiceCategory);

/**
 * @route   PATCH /api/v1/master-data/service-categories/:id/toggle-active
 * @desc    Toggle active state of a service category
 */
serviceCategoryRoutes.patch("/:id/toggle-active", toggleActiveServiceCategory);

/**
 * @route   DELETE /api/v1/master-data/service-categories/:id
 * @desc    Soft delete a service category
 */
serviceCategoryRoutes.delete("/:id", deleteServiceCategory);

export default serviceCategoryRoutes;
