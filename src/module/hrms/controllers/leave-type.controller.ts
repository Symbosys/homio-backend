import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leaveTypeService } from "../services/leave-type.service.js";
import {
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  leaveTypeIdParamSchema,
  getLeaveTypesQuerySchema,
} from "../validators/leave-type.validator.js";

/**
 * Controller: Create leave type
 */
export const createLeaveType = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createLeaveTypeSchema.parse({ body: req.body });
  const result = await leaveTypeService.createLeaveType(organizationId, parsed.body, req.user?.id);

  return SuccessResponse(res, "Leave type created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all leave types
 */
export const getLeaveTypes = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getLeaveTypesQuerySchema.parse({ query: req.query });
  const result = await leaveTypeService.getLeaveTypes(organizationId, parsed.query);

  return SuccessResponse(res, "Leave types retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single leave type by ID
 */
export const getLeaveTypeById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = leaveTypeIdParamSchema.parse({ params: req.params });
  const result = await leaveTypeService.getLeaveTypeById(params.id, organizationId);

  return SuccessResponse(res, "Leave type retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update leave type
 */
export const updateLeaveType = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateLeaveTypeSchema.parse({ params: req.params, body: req.body });
  const result = await leaveTypeService.updateLeaveType(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Leave type updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete leave type
 */
export const deleteLeaveType = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = leaveTypeIdParamSchema.parse({ params: req.params });
  await leaveTypeService.deleteLeaveType(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Leave type deleted successfully", null, statusCode.OK);
});
