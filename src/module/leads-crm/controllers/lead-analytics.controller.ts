import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadAnalyticsService } from "../services/lead-analytics.service.js";
import { leadAnalyticsQuerySchema } from "../validators/lead-analytics.validator.js";

/**
 * Controller: Get CRM Pipeline Funnel and Sales Rep Metrics
 */
export const getPipelineAnalytics = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = leadAnalyticsQuerySchema.parse({ query: req.query });
  const result = await leadAnalyticsService.getPipelineAnalytics(organizationId, parsed.query);
  return SuccessResponse(res, "Pipeline analytics retrieved successfully", result, statusCode.OK);
});
