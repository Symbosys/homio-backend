import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourRatingService } from "../services/labour-rating.service.js";
import {
  createLabourRatingSchema,
  updateLabourRatingSchema,
  getLabourRatingsQuerySchema,
  ratingIdParamSchema,
} from "../validators/labour-rating.validator.js";

/**
 * @route   POST /api/v1/labour/ratings
 * @desc    Submit a performance review for a worker on a booking
 * @access  Private (Authenticated Tenant User)
 */
export const createLabourRating = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLabourRatingSchema.parse({ body: req.body });
  const result = await labourRatingService.createRating(parsed.body, organizationId);
  return SuccessResponse(res, "Labour rating submitted successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/ratings
 * @desc    Fetch paginated worker ratings with filters
 * @access  Private (Authenticated Tenant User)
 */
export const getAllLabourRatings = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLabourRatingsQuerySchema.parse({ query: req.query });
  const result = await labourRatingService.getRatings(parsed.query, organizationId);
  return SuccessResponse(res, "Labour ratings retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/ratings/:id
 * @desc    Get rating details by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourRatingById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = ratingIdParamSchema.parse({ params: req.params });
  const result = await labourRatingService.getRatingById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour rating retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/ratings/:id
 * @desc    Full symmetric update of rating (Rule 19)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourRating = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLabourRatingSchema.parse({ params: req.params, body: req.body });
  const result = await labourRatingService.updateRating(parsed.params.id, parsed.body, organizationId);
  return SuccessResponse(res, "Labour rating updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/ratings/:id
 * @desc    Delete labour rating
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabourRating = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = ratingIdParamSchema.parse({ params: req.params });
  await labourRatingService.deleteRating(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour rating deleted successfully", null, statusCode.OK);
});
