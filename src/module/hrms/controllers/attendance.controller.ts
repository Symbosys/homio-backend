import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { attendanceService } from "../services/attendance.service.js";
import {
  punchInSchema,
  punchOutSchema,
  getAttendancesQuerySchema,
  getMyAttendanceQuerySchema,
  attendanceIdParamSchema,
  dailySummaryQuerySchema,
  regularizeAttendanceSchema,
} from "../validators/attendance.validator.js";

/**
 * Controller: Live Facial Selfie Punch In
 */
export const punchIn = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = punchInSchema.parse({ body: req.body });
  const result = await attendanceService.punchIn(organizationId, userId, parsed.body, req.file);

  return SuccessResponse(res, "Punch In successful", result, statusCode.Created);
});

/**
 * Controller: Live Facial Selfie Punch Out
 */
export const punchOut = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = punchOutSchema.parse({ body: req.body });
  const result = await attendanceService.punchOut(organizationId, userId, parsed.body, req.file);

  return SuccessResponse(res, "Punch Out successful", result, statusCode.OK);
});

/**
 * Controller: Get today's punch status for logged-in user
 */
export const getTodayStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const result = await attendanceService.getTodayStatus(organizationId, userId);
  return SuccessResponse(res, "Today's attendance status retrieved", result, statusCode.OK);
});

/**
 * Controller: Get personal attendance logs
 */
export const getMyAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = getMyAttendanceQuerySchema.parse({ query: req.query });
  const result = await attendanceService.getMyAttendanceHistory(organizationId, userId, parsed.query);

  return SuccessResponse(res, "Personal attendance history retrieved", result, statusCode.OK);
});

/**
 * Controller: Get all attendance logs (Admin / HR)
 */
export const getAllAttendances = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getAttendancesQuerySchema.parse({ query: req.query });
  const result = await attendanceService.getAllAttendances(organizationId, parsed.query);

  return SuccessResponse(res, "Attendances retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get daily summary dashboard metrics
 */
export const getDailySummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = dailySummaryQuerySchema.parse({ query: req.query });
  const result = await attendanceService.getDailySummary(organizationId, parsed.query.date);

  return SuccessResponse(res, "Daily attendance summary retrieved", result, statusCode.OK);
});

/**
 * Controller: Get single attendance record by ID
 */
export const getAttendanceById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = attendanceIdParamSchema.parse({ params: req.params });
  const result = await attendanceService.getAttendanceById(params.id, organizationId);

  return SuccessResponse(res, "Attendance record retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Regularize / manually adjust attendance
 */
export const regularizeAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = regularizeAttendanceSchema.parse({ params: req.params, body: req.body });
  const result = await attendanceService.regularizeAttendance(parsed.params.id, organizationId, parsed.body);

  return SuccessResponse(res, "Attendance regularized successfully", result, statusCode.OK);
});
