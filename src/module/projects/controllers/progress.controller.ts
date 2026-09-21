import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { progressService } from "../services/progress.service.js";
import {
  createProgressSchema,
  updateProgressSchema,
  reviewProgressSchema,
  getProgressQuerySchema,
  progressProjectIdParamSchema,
  progressIdParamSchema,
} from "../validators/progress.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/progress
 * @desc    Submit a daily site progress log with photos, videos, and work notes
 * @access  Private (Authenticated Tenant User)
 */
export const createProgress = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProgressSchema.parse({ params: req.params, body: req.body });
  const result = await progressService.createProgress(
    parsed.params.projectId,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Site progress entry logged successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/progress
 * @desc    Fetch paginated progress logs with date range, area, and approval status filters
 * @access  Private (Authenticated Tenant User)
 */
export const getProgressList = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = progressProjectIdParamSchema.parse({ params: req.params });
  const parsedQuery = getProgressQuerySchema.parse({ query: req.query });

  const result = await progressService.getProgressList(
    parsedParams.params.projectId,
    organizationId,
    parsedQuery.query
  );
  return SuccessResponse(res, "Site progress entries retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/progress/:id
 * @desc    Fetch comprehensive details of a single progress log by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getProgressById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = progressIdParamSchema.parse({ params: req.params });
  const result = await progressService.getProgressById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Site progress details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/:id
 * @desc    Update site progress field log
 * @access  Private (Authenticated Tenant User)
 */
export const updateProgress = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProgressSchema.parse({ params: req.params, body: req.body });
  const result = await progressService.updateProgress(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Site progress entry updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/:id/approval
 * @desc    Review and approve, reject, or request revision on a site progress report
 * @access  Private (Authenticated Tenant User)
 */
export const reviewProgress = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = reviewProgressSchema.parse({ params: req.params, body: req.body });
  const result = await progressService.reviewProgress(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body,
    req.user
  );
  return SuccessResponse(res, "Site progress approval status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/progress/:id
 * @desc    Soft delete a site progress entry
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProgress = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = progressIdParamSchema.parse({ params: req.params });
  const result = await progressService.deleteProgress(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Site progress entry deleted successfully", result, statusCode.OK);
});
