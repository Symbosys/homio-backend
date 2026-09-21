import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createExpenseCategory,
  getExpenseCategories,
  getExpenseCategoryById,
  updateExpenseCategory,
  deleteExpenseCategory,
  seedDefaultExpenseCategories,
} from "../controllers/expense-category.controller.js";

const expenseCategoryRoutes = Router();

// Protect all expense category routes
expenseCategoryRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/expense-categories/seed-defaults
 * @desc    Seed standard industry expense categories (materials, labour, software, rent)
 */
expenseCategoryRoutes.post("/seed-defaults", seedDefaultExpenseCategories);

/**
 * @route   POST /api/v1/projects/expense-categories
 * @desc    Create a new custom expense category for the organization
 */
expenseCategoryRoutes.post("/", createExpenseCategory);

/**
 * @route   GET /api/v1/projects/expense-categories
 * @desc    Fetch paginated list of expense categories for the organization
 */
expenseCategoryRoutes.get("/", getExpenseCategories);

/**
 * @route   GET /api/v1/projects/expense-categories/:id
 * @desc    Fetch details of a single expense category
 */
expenseCategoryRoutes.get("/:id", getExpenseCategoryById);

/**
 * @route   PATCH /api/v1/projects/expense-categories/:id
 * @desc    Update expense category details, theming, or tax status
 */
expenseCategoryRoutes.patch("/:id", updateExpenseCategory);

/**
 * @route   DELETE /api/v1/projects/expense-categories/:id
 * @desc    Soft delete an expense category (prevented if actively referenced)
 */
expenseCategoryRoutes.delete("/:id", deleteExpenseCategory);

export default expenseCategoryRoutes;
