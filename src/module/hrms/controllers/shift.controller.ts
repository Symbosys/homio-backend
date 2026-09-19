import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { shiftService } from "../services/shift.service.js";
import {
  createShiftSchema,
  updateShiftSchema,
  shiftIdParamSchema,
  getShiftsQuerySchema,
  assignEmployeesToShiftSchema,
  unassignEmployeeFromShiftSchema,
} from "../validators/shift.validator.js";

/**
 * Controller: Create a new shift
 */
export const createShift = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createShiftSchema.parse({ body: req.body });
  const result = await shiftService.createShift(organizationId, parsed.body, req.user?.id);

  return SuccessResponse(res, "Shift created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all shifts
 */
export const getShifts = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getShiftsQuerySchema.parse({ query: req.query });
  const result = await shiftService.getShifts(organizationId, parsed.query);

  return SuccessResponse(res, "Shifts retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single shift by ID
 */
export const getShiftById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = shiftIdParamSchema.parse({ params: req.params });
  const result = await shiftService.getShiftById(params.id, organizationId);

  return SuccessResponse(res, "Shift retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update shift
 */
export const updateShift = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateShiftSchema.parse({ params: req.params, body: req.body });
  const result = await shiftService.updateShift(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Shift updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete shift
 */
export const deleteShift = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = shiftIdParamSchema.parse({ params: req.params });
  await shiftService.deleteShift(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Shift deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Bulk assign employees to shift
 */
export const assignEmployees = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = assignEmployeesToShiftSchema.parse({ params: req.params, body: req.body });
  const result = await shiftService.assignEmployees(parsed.params.id, organizationId, parsed.body);

  return SuccessResponse(res, "Employees assigned to shift successfully", result, statusCode.OK);
});

/**
 * Controller: Unassign employee from shift
 */
export const unassignEmployee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = unassignEmployeeFromShiftSchema.parse({ params: req.params });
  const result = await shiftService.unassignEmployee(params.employeeId, organizationId);

  return SuccessResponse(res, "Employee unassigned from shift successfully", result, statusCode.OK);
});
