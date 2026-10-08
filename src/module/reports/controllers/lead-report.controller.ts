import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadReportService } from "../services/lead-report.service.js";
import {
  getEmployeePerformanceQuerySchema,
  getTopPerformersQuerySchema,
} from "../validators/lead-report.validator.js";

/**
 * Controller: Get lead conversion performance by employee with timeline and distribution charts
 * @route   GET /api/v1/reports/leads/employee-performance
 * @desc    Fetches employee lead conversion stats, status breakdowns, and monthly/weekly time series
 */
export const getEmployeeLeadPerformance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getEmployeePerformanceQuerySchema.parse({ query: req.query });
  const result = await leadReportService.getEmployeePerformance(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "Employee lead conversion performance retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Get top performing employees ranked by conversions, rate, or revenue
 * @route   GET /api/v1/reports/leads/top-performers
 * @desc    Fetches ranked leaderboard of sales/design personnel based on conversion metrics
 */
export const getTopLeadPerformers = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getTopPerformersQuerySchema.parse({ query: req.query });
  const result = await leadReportService.getTopPerformers(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "Top performing personnel retrieved successfully",
    result,
    statusCode.OK
  );
});
