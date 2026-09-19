import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leaveRequestService } from "../services/leave-request.service.js";
import {
  applyLeaveSchema,
  getLeaveRequestsQuerySchema,
  getMyLeavesQuerySchema,
  leaveRequestIdParamSchema,
  employeeIdParamSchema,
  approveLeaveSchema,
  rejectLeaveSchema,
} from "../validators/leave-request.validator.js";

/**
 * Controller: Apply for leave
 */
export const applyLeave = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = applyLeaveSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await leaveRequestService.applyLeave(organizationId, userId, parsed.body, files);

  return SuccessResponse(res, "Leave application submitted successfully", result, statusCode.Created);
});

/**
 * Controller: Get personal leave applications
 */
export const getMyLeaves = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = getMyLeavesQuerySchema.parse({ query: req.query });
  const result = await leaveRequestService.getMyLeaves(organizationId, userId, parsed.query);

  return SuccessResponse(res, "Your leave applications retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get personal leave balance breakdown
 */
export const getMyLeaveBalance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const result = await leaveRequestService.getMyLeaveBalance(organizationId, userId);
  return SuccessResponse(res, "Leave balance summary retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get all leave requests (Admin / HR)
 */
export const getAllLeaveRequests = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getLeaveRequestsQuerySchema.parse({ query: req.query });
  const result = await leaveRequestService.getAllLeaveRequests(organizationId, parsed.query);

  return SuccessResponse(res, "Leave requests retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single leave request by ID
 */
export const getLeaveRequestById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = leaveRequestIdParamSchema.parse({ params: req.params });
  const result = await leaveRequestService.getLeaveRequestById(params.id, organizationId);

  return SuccessResponse(res, "Leave request details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Approve leave request
 */
export const approveLeave = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = approveLeaveSchema.parse({ params: req.params, body: req.body });
  const result = await leaveRequestService.approveLeave(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body.adminRemarks
  );

  return SuccessResponse(res, "Leave request approved successfully", result, statusCode.OK);
});

/**
 * Controller: Reject leave request
 */
export const rejectLeave = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = rejectLeaveSchema.parse({ params: req.params, body: req.body });
  const result = await leaveRequestService.rejectLeave(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body.adminRemarks
  );

  return SuccessResponse(res, "Leave request rejected successfully", result, statusCode.OK);
});

/**
 * Controller: Cancel leave request
 */
export const cancelLeave = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const { params } = leaveRequestIdParamSchema.parse({ params: req.params });
  const result = await leaveRequestService.cancelLeave(params.id, organizationId, userId);

  return SuccessResponse(res, "Leave request cancelled successfully", result, statusCode.OK);
});

/**
 * Controller: Get leave balance for specific employee (Admin view)
 */
export const getEmployeeLeaveBalance = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = employeeIdParamSchema.parse({ params: req.params });
  const result = await leaveRequestService.getEmployeeLeaveBalance(params.employeeId, organizationId);

  return SuccessResponse(res, "Employee leave balance retrieved successfully", result, statusCode.OK);
});
