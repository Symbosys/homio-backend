import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { complaintSnagCategoryService } from "../services/complaint-snag-category.service.js";
import {
  createComplaintSnagCategorySchema,
  updateComplaintSnagCategorySchema,
  getComplaintSnagCategoriesQuerySchema,
  complaintSnagCategoryIdParamSchema,
} from "../validators/complaint-snag-category.validator.js";

/**
 * @route   POST /api/v1/master-data/complaint-snag-categories
 * @desc    Create a new complaint/snag category for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createComplaintSnagCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createComplaintSnagCategorySchema.parse({ body: req.body });
  const result = await complaintSnagCategoryService.createCategory(organizationId, parsed.body);
  return SuccessResponse(res, "Complaint/snag category created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/master-data/complaint-snag-categories
 * @desc    Fetch paginated list of complaint/snag categories for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const getComplaintSnagCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getComplaintSnagCategoriesQuerySchema.parse({ query: req.query });
  const result = await complaintSnagCategoryService.getCategories(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Complaint/snag categories retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Fetch details of a single complaint/snag category with usage counts
 * @access  Private (Authenticated Tenant User)
 */
export const getComplaintSnagCategoryById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = complaintSnagCategoryIdParamSchema.parse({ params: req.params });
  const result = await complaintSnagCategoryService.getCategoryById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Complaint/snag category retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Update complaint/snag category details
 * @access  Private (Authenticated Tenant User)
 */
export const updateComplaintSnagCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateComplaintSnagCategorySchema.parse({ params: req.params, body: req.body });
  const result = await complaintSnagCategoryService.updateCategory(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Complaint/snag category updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/master-data/complaint-snag-categories/:id
 * @desc    Soft delete a complaint/snag category
 * @access  Private (Authenticated Tenant User)
 */
export const deleteComplaintSnagCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = complaintSnagCategoryIdParamSchema.parse({ params: req.params });
  await complaintSnagCategoryService.deleteCategory(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Complaint/snag category deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/complaint-snag-categories/:id/toggle-active
 * @desc    Toggle active state of a complaint/snag category
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveComplaintSnagCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = complaintSnagCategoryIdParamSchema.parse({ params: req.params });
  const result = await complaintSnagCategoryService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Complaint/snag category status updated successfully", result, statusCode.OK);
});
