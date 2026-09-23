import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createComplaintSnagCategory,
  getComplaintSnagCategories,
  getComplaintSnagCategoryById,
  updateComplaintSnagCategory,
  deleteComplaintSnagCategory,
  toggleActiveComplaintSnagCategory,
} from "../controllers/complaint-snag-category.controller.js";

const complaintSnagCategoryRoutes = Router();

// Protect all complaint/snag category routes
complaintSnagCategoryRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/master-data/complaint-snag-categories
 * @desc    Create a new complaint/snag category for the organization
 */
complaintSnagCategoryRoutes.post("/", createComplaintSnagCategory);

/**
 * @route   GET /api/v1/master-data/complaint-snag-categories
 * @desc    Fetch paginated list of complaint/snag categories for the organization
 */
complaintSnagCategoryRoutes.get("/", getComplaintSnagCategories);

/**
 * @route   GET /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Fetch details of a single complaint/snag category
 */
complaintSnagCategoryRoutes.get("/:id", getComplaintSnagCategoryById);

/**
 * @route   PATCH /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Update complaint/snag category details
 */
complaintSnagCategoryRoutes.patch("/:id", updateComplaintSnagCategory);

/**
 * @route   PATCH /api/v1/master-data/complaint-snag-categories/:id/toggle-active
 * @desc    Toggle active state of a complaint/snag category
 */
complaintSnagCategoryRoutes.patch("/:id/toggle-active", toggleActiveComplaintSnagCategory);

/**
 * @route   DELETE /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Soft delete a complaint/snag category
 */
complaintSnagCategoryRoutes.delete("/:id", deleteComplaintSnagCategory);

export default complaintSnagCategoryRoutes;
