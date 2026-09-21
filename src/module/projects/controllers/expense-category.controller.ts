import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { expenseCategoryService } from "../services/expense-category.service.js";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  getExpenseCategoriesQuerySchema,
  expenseCategoryIdParamSchema,
} from "../validators/expense-category.validator.js";

/**
 * @route   POST /api/v1/projects/expense-categories
 * @desc    Create a new custom expense category for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createExpenseCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createExpenseCategorySchema.parse({ body: req.body });
  const result = await expenseCategoryService.createCategory(organizationId, parsed.body);
  return SuccessResponse(res, "Expense category created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/expense-categories
 * @desc    Fetch paginated list of expense categories for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const getExpenseCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getExpenseCategoriesQuerySchema.parse({ query: req.query });
  const result = await expenseCategoryService.getCategories(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Expense categories retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/expense-categories/:id
 * @desc    Fetch details of a single expense category
 * @access  Private (Authenticated Tenant User)
 */
export const getExpenseCategoryById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = expenseCategoryIdParamSchema.parse({ params: req.params });
  const result = await expenseCategoryService.getCategoryById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Expense category retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/expense-categories/:id
 * @desc    Update expense category details, theming, or tax status
 * @access  Private (Authenticated Tenant User)
 */
export const updateExpenseCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateExpenseCategorySchema.parse({ params: req.params, body: req.body });
  const result = await expenseCategoryService.updateCategory(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Expense category updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/expense-categories/:id
 * @desc    Soft delete an expense category (prevented if actively referenced)
 * @access  Private (Authenticated Tenant User)
 */
export const deleteExpenseCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = expenseCategoryIdParamSchema.parse({ params: req.params });
  await expenseCategoryService.deleteCategory(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Expense category deleted successfully", null, statusCode.OK);
});

/**
 * @route   POST /api/v1/projects/expense-categories/seed-defaults
 * @desc    Seed standard industry expense categories (materials, labour, software, rent)
 * @access  Private (Authenticated Tenant User)
 */
export const seedDefaultExpenseCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await expenseCategoryService.seedDefaults(organizationId);
  return SuccessResponse(res, "Standard expense categories seeded successfully", result, statusCode.Created);
});
