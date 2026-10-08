import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { hrmsReportsService } from "../services/hrms-report.service.js";
import {
  getHrmsReportQuerySchema,
  getHrmsIncentivesReportQuerySchema,
} from "../validators/hrms-report.validator.js";

/**
 * Controller: Get HRMS overview summary report (Payroll + Incentives + Attendance)
 */
export const getHrmsReportSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const parsed = getHrmsReportQuerySchema.parse({ query: req.query });
  const result = await hrmsReportsService.getHrmsReportSummary(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "HRMS analytics report retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Get employee incentives report
 */
export const getEmployeeIncentivesReport = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const parsed = getHrmsIncentivesReportQuerySchema.parse({ query: req.query });
  const result = await hrmsReportsService.getEmployeeIncentivesReport(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "Employee incentives report retrieved successfully",
    result,
    statusCode.OK
  );
});
