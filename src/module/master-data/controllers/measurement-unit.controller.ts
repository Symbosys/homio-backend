import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { measurementUnitService } from "../services/measurement-unit.service.js";
import {
  createMeasurementUnitSchema,
  updateMeasurementUnitSchema,
  getMeasurementUnitsQuerySchema,
  measurementUnitIdParamSchema,
} from "../validators/measurement-unit.validator.js";

/**
 * @route   POST /api/v1/master-data/measurement-units
 * @desc    Create a new measurement unit for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createMeasurementUnit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createMeasurementUnitSchema.parse({ body: req.body });
  const result = await measurementUnitService.createUnit(organizationId, parsed.body);
  return SuccessResponse(res, "Measurement unit created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/master-data/measurement-units
 * @desc    Fetch paginated list of measurement units for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const getMeasurementUnits = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getMeasurementUnitsQuerySchema.parse({ query: req.query });
  const result = await measurementUnitService.getUnits(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Measurement units retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/master-data/measurement-units/:id
 * @desc    Fetch details of a single measurement unit
 * @access  Private (Authenticated Tenant User)
 */
export const getMeasurementUnitById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = measurementUnitIdParamSchema.parse({ params: req.params });
  const result = await measurementUnitService.getUnitById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Measurement unit retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/measurement-units/:id
 * @desc    Update measurement unit details
 * @access  Private (Authenticated Tenant User)
 */
export const updateMeasurementUnit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateMeasurementUnitSchema.parse({ params: req.params, body: req.body });
  const result = await measurementUnitService.updateUnit(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Measurement unit updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/master-data/measurement-units/:id
 * @desc    Soft delete a measurement unit
 * @access  Private (Authenticated Tenant User)
 */
export const deleteMeasurementUnit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = measurementUnitIdParamSchema.parse({ params: req.params });
  await measurementUnitService.deleteUnit(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Measurement unit deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/measurement-units/:id/toggle-active
 * @desc    Toggle active state of a measurement unit
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveMeasurementUnit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = measurementUnitIdParamSchema.parse({ params: req.params });
  const result = await measurementUnitService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Measurement unit status updated successfully", result, statusCode.OK);
});
