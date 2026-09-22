import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { categoryService } from "../services/category.service.js";
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  getServiceCategoriesQuerySchema,
  categoryIdParamSchema,
} from "../validators/category.validator.js";

/**
 * @route   POST /api/v1/after-sales/categories
 * @desc    Create a custom service category
 * @access  Private (Admin)
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const validatedBody = createServiceCategorySchema.parse(req.body);
  const category = await categoryService.createCategory(organizationId, validatedBody);

  return SuccessResponse(res, "Service category created successfully", category, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/categories
 * @desc    List service categories for the tenant
 * @access  Private
 */
export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const query = getServiceCategoriesQuerySchema.parse(req.query);
  const result = await categoryService.getCategories(organizationId, query);

  return SuccessResponse(res, "Service categories fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/categories/:id
 * @desc    Get single service category details
 * @access  Private
 */
export const getCategoryById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = categoryIdParamSchema.parse(req.params);
  const category = await categoryService.getCategoryById(organizationId, id);

  return SuccessResponse(res, "Service category fetched successfully", category, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/categories/:id
 * @desc    Update service category (dirty fields)
 * @access  Private (Admin)
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = categoryIdParamSchema.parse(req.params);
  const validatedBody = updateServiceCategorySchema.parse(req.body);
  const updated = await categoryService.updateCategory(organizationId, id, validatedBody);

  return SuccessResponse(res, "Service category updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/categories/:id/toggle-status
 * @desc    Toggle category active status
 * @access  Private (Admin)
 */
export const toggleCategoryStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = categoryIdParamSchema.parse(req.params);
  const updated = await categoryService.toggleCategoryStatus(organizationId, id);

  return SuccessResponse(res, "Service category status toggled successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/categories/:id
 * @desc    Soft delete service category
 * @access  Private (Admin)
 */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = categoryIdParamSchema.parse(req.params);
  await categoryService.deleteCategory(organizationId, id);

  return SuccessResponse(res, "Service category deleted successfully", null, statusCode.OK);
});

/**
 * @route   POST /api/v1/after-sales/categories/seed-defaults
 * @desc    Seed standard default categories for the tenant
 * @access  Private (Admin)
 */
export const seedDefaultCategories = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const seeded = await categoryService.seedDefaultCategories(organizationId);

  return SuccessResponse(res, "Default service categories seeded successfully", seeded, statusCode.OK);
});
