import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourAttendanceService } from "../services/labour-attendance.service.js";
import {
  punchInSchema,
  punchOutSchema,
  createManualAttendanceSchema,
  updateAttendanceSchema,
  approveAttendanceSchema,
  getAttendancesQuerySchema,
  attendanceIdParamSchema,
} from "../validators/labour-attendance.validator.js";

/**
 * @route   POST /api/v1/labour/attendances/punch-in
 * @desc    Geofenced punch-in with live camera selfie and GPS distance calculation
 * @access  Private (Authenticated Tenant User)
 */
export const punchIn = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = punchInSchema.parse({ body: req.body });
  const result = await labourAttendanceService.punchIn(parsed.body, organizationId, req.file);
  return SuccessResponse(res, "Attendance punch-in recorded successfully", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/attendances/:id/punch-out
 * @desc    Geofenced punch-out with live camera selfie and automated hour calculation
 * @access  Private (Authenticated Tenant User)
 */
export const punchOut = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = punchOutSchema.parse({ params: req.params, body: req.body });
  const result = await labourAttendanceService.punchOut(
    parsed.params.id,
    parsed.body,
    organizationId,
    req.file
  );
  return SuccessResponse(res, "Attendance punch-out recorded successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/attendances/manual
 * @desc    Manual attendance entry by site supervisor
 * @access  Private (Authenticated Tenant User)
 */
export const createManualAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createManualAttendanceSchema.parse({ body: req.body });
  const result = await labourAttendanceService.createManualAttendance(parsed.body, organizationId);
  return SuccessResponse(res, "Manual attendance created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/attendances
 * @desc    Fetch paginated attendance records with site and status filters
 * @access  Private (Authenticated Tenant User)
 */
export const getAllAttendances = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getAttendancesQuerySchema.parse({ query: req.query });
  const result = await labourAttendanceService.getAttendances(parsed.query, organizationId);
  return SuccessResponse(res, "Labour attendances retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/attendances/:id
 * @desc    Get detailed attendance record by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getAttendanceById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = attendanceIdParamSchema.parse({ params: req.params });
  const result = await labourAttendanceService.getAttendanceById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour attendance retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/attendances/:id
 * @desc    Full symmetric update of attendance record (Rule 19)
 * @access  Private (Authenticated Tenant User)
 */
export const updateAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateAttendanceSchema.parse({ params: req.params, body: req.body });
  const result = await labourAttendanceService.updateAttendance(
    parsed.params.id,
    parsed.body,
    organizationId
  );
  return SuccessResponse(res, "Labour attendance updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/attendances/:id/approve
 * @desc    Supervisor sign-off and approval of attendance shift
 * @access  Private (Authenticated Tenant User)
 */
export const approveAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = approveAttendanceSchema.parse({ params: req.params, body: req.body });
  const result = await labourAttendanceService.approveAttendance(
    parsed.params.id,
    parsed.body,
    organizationId
  );
  return SuccessResponse(res, "Attendance approved successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/attendances/:id
 * @desc    Delete attendance record and prune associated cloud selfies
 * @access  Private (Authenticated Tenant User)
 */
export const deleteAttendance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = attendanceIdParamSchema.parse({ params: req.params });
  await labourAttendanceService.deleteAttendance(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour attendance deleted successfully", null, statusCode.OK);
});
