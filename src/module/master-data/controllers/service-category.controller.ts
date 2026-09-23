import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { serviceCategoryService } from "../services/service-category.service.js";
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  getServiceCategoriesQuerySchema,
  serviceCategoryIdParamSchema,
} from "../validators/service-category.validator.js";

/**
 * @route   POST /api/v1/master-data/service-categories
 * @desc    Create a new service category for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createServiceCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createServiceCategorySchema.parse({ body: req.body });
  const result = await serviceCategoryService.createCategory(organizationId, parsed.body);
  return SuccessResponse(res, "Service category created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/master-data/service-categories
 * @desc    Fetch paginated list of service categories for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const getServiceCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getServiceCategoriesQuerySchema.parse({ query: req.query });
  const result = await serviceCategoryService.getCategories(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Service categories retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/master-data/service-categories/:id
 * @desc    Fetch details of a single service category with cross-module usage counts
 * @access  Private (Authenticated Tenant User)
 */
export const getServiceCategoryById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = serviceCategoryIdParamSchema.parse({ params: req.params });
  const result = await serviceCategoryService.getCategoryById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Service category retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/service-categories/:id
 * @desc    Update service category details
 * @access  Private (Authenticated Tenant User)
 */
export const updateServiceCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateServiceCategorySchema.parse({ params: req.params, body: req.body });
  const result = await serviceCategoryService.updateCategory(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Service category updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/master-data/service-categories/:id
 * @desc    Soft delete a service category
 * @access  Private (Authenticated Tenant User)
 */
export const deleteServiceCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = serviceCategoryIdParamSchema.parse({ params: req.params });
  await serviceCategoryService.deleteCategory(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Service category deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/service-categories/:id/toggle-active
 * @desc    Toggle active state of a service category
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveServiceCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = serviceCategoryIdParamSchema.parse({ params: req.params });
  const result = await serviceCategoryService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Service category status updated successfully", result, statusCode.OK);
});
