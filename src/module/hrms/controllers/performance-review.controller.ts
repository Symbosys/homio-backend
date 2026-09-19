import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { performanceReviewService } from "../services/performance-review.service.js";
import {
  createPerformanceReviewSchema,
  updatePerformanceReviewSchema,
  getPerformanceReviewsQuerySchema,
  performanceReviewIdParamSchema,
} from "../validators/performance-review.validator.js";

/**
 * Controller: Create / submit a performance review scorecard
 */
export const createReview = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = createPerformanceReviewSchema.parse({ body: req.body });
  const result = await performanceReviewService.createReview(organizationId, userId, parsed.body);

  return SuccessResponse(res, "Performance review created successfully", result, statusCode.Created);
});

/**
 * Controller: Get personal reviews for the logged-in employee
 */
export const getMyReviews = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const result = await performanceReviewService.getMyReviews(organizationId, userId);
  return SuccessResponse(res, "Your performance reviews retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get all performance reviews for organization (Admin / HR)
 */
export const getAllReviews = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getPerformanceReviewsQuerySchema.parse({ query: req.query });
  const result = await performanceReviewService.getAllReviews(organizationId, parsed.query);

  return SuccessResponse(res, "Performance reviews retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single performance review by ID
 */
export const getReviewById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = performanceReviewIdParamSchema.parse({ params: req.params });
  const result = await performanceReviewService.getReviewById(params.id, organizationId);

  return SuccessResponse(res, "Performance review details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update performance review scorecard
 */
export const updateReview = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updatePerformanceReviewSchema.parse({ params: req.params, body: req.body });
  const result = await performanceReviewService.updateReview(
    parsed.params.id,
    organizationId,
    parsed.body
  );

  return SuccessResponse(res, "Performance review updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete performance review
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = performanceReviewIdParamSchema.parse({ params: req.params });
  const result = await performanceReviewService.deleteReview(params.id, organizationId);

  return SuccessResponse(res, result.message, null, statusCode.OK);
});
