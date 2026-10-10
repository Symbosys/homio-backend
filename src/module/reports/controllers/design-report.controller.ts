import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { designReportService } from "../services/design-report.service.js";
import { getDesignReportsQuerySchema } from "../validators/design-report.validator.js";

/**
 * @controller  getDesignAnalytics
 * @route       GET /api/v1/reports/designs/analytics
 * @desc        Fetches enterprise-grade design analytics, DAM KPIs, employee leaderboard, and timeline trends
 * @access      Protected (Tenant Authenticated)
 * @param       req.user.organizationId - Tenant UUID scope
 * @param       req.query - Query filters (projectId, employeeId, folderId, datePreset, startDate, endDate, stage, etc.)
 * @returns     JSON response with comprehensive Design & DAM report metrics
 */
export const getDesignAnalytics = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getDesignReportsQuerySchema.parse({ query: req.query });
  const result = await designReportService.getDesignAnalytics(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "Design and DAM analytics report retrieved successfully",
    result,
    statusCode.OK
  );
});
