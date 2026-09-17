import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { categoryService } from "../services/category.service.js";
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoryQuerySchema,
  categoryIdParamSchema,
  marketplaceTypeEnum,
} from "../validators/category.validator.js";

/**
 * Platform Admin: Create master category
 */
export const createCategory = asyncHandler(async (req, res) => {
  const parsed = createCategorySchema.parse({ body: req.body });
  const category = await categoryService.createCategory(parsed.body, req.file);
  return SuccessResponse(res, "Marketplace category created successfully", category, statusCode.Created);
});

/**
 * Public/Authenticated: Get paginated list of categories
 */
export const getCategories = asyncHandler(async (req, res) => {
  const parsed = getCategoryQuerySchema.parse({ query: req.query });
  const result = await categoryService.getCategories(parsed.query);
  return SuccessResponse(res, "Categories retrieved successfully", result, statusCode.OK);
});

/**
 * Public/Authenticated: Get category tree hierarchy
 */
export const getCategoryTree = asyncHandler(async (req, res) => {
  const vertical = req.query.marketplaceType ? marketplaceTypeEnum.parse(req.query.marketplaceType) : undefined;
  const tree = await categoryService.getCategoryTree(vertical);
  return SuccessResponse(res, "Category tree retrieved successfully", tree, statusCode.OK);
});

/**
 * Public/Authenticated: Get single category by ID or slug
 */
export const getCategoryById = asyncHandler(async (req, res) => {
  const parsed = categoryIdParamSchema.parse({ params: req.params });
  const category = await categoryService.getCategoryById(parsed.params.id);
  return SuccessResponse(res, "Category details retrieved successfully", category, statusCode.OK);
});

/**
 * Platform Admin: Update category
 */
export const updateCategory = asyncHandler(async (req, res) => {
  const parsed = updateCategorySchema.parse({ params: req.params, body: req.body });
  const category = await categoryService.updateCategory(parsed.params.id, parsed.body, req.file);
  return SuccessResponse(res, "Category updated successfully", category, statusCode.OK);
});

/**
 * Platform Admin: Soft-delete category
 */
export const deleteCategory = asyncHandler(async (req, res) => {
  const parsed = categoryIdParamSchema.parse({ params: req.params });
  await categoryService.deleteCategory(parsed.params.id);
  return SuccessResponse(res, "Category deleted successfully", {}, statusCode.OK);
});
