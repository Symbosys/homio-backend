import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { analyticsService } from "../services/analytics.service.js";
import { projectAnalyticsParamSchema } from "../validators/analytics.validator.js";

/**
 * @route   GET /api/v1/after-sales/analytics/overview
 * @desc    Get tenant-wide after-sales KPIs and metrics
 * @access  Private
 */
export const getOverviewMetrics = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const metrics = await analyticsService.getOverviewMetrics(organizationId);

  return SuccessResponse(res, "After-sales overview metrics fetched successfully", metrics, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/analytics/project/:projectId
 * @desc    Get project-specific after-sales metrics & health
 * @access  Private
 */
export const getProjectMetrics = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { projectId } = projectAnalyticsParamSchema.parse(req.params);
  const metrics = await analyticsService.getProjectMetrics(organizationId, projectId);

  return SuccessResponse(res, "Project after-sales metrics fetched successfully", metrics, statusCode.OK);
});
