import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { geofenceService } from "../services/geofence.service.js";
import {
  createGeofenceSchema,
  updateGeofenceSchema,
  geofenceIdParamSchema,
  getGeofencesQuerySchema,
  assignEmployeesToGeofenceSchema,
  employeeGeofencesParamSchema,
} from "../validators/geofence.validator.js";

/**
 * Controller: Create a new geofence
 */
export const createGeofence = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createGeofenceSchema.parse({ body: req.body });
  const result = await geofenceService.createGeofence(organizationId, parsed.body, req.user?.id);

  return SuccessResponse(res, "Geofence area created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all geofences
 */
export const getGeofences = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getGeofencesQuerySchema.parse({ query: req.query });
  const result = await geofenceService.getGeofences(organizationId, parsed.query);

  return SuccessResponse(res, "Geofences retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single geofence by ID
 */
export const getGeofenceById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = geofenceIdParamSchema.parse({ params: req.params });
  const result = await geofenceService.getGeofenceById(params.id, organizationId);

  return SuccessResponse(res, "Geofence retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update geofence
 */
export const updateGeofence = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateGeofenceSchema.parse({ params: req.params, body: req.body });
  const result = await geofenceService.updateGeofence(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Geofence updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete geofence
 */
export const deleteGeofence = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = geofenceIdParamSchema.parse({ params: req.params });
  await geofenceService.deleteGeofence(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Geofence deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Bulk assign/unassign employees
 */
export const assignEmployees = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = assignEmployeesToGeofenceSchema.parse({ params: req.params, body: req.body });
  const result = await geofenceService.assignEmployees(parsed.params.id, organizationId, parsed.body);

  return SuccessResponse(
    res,
    `Employees ${parsed.body.action === "ASSIGN" ? "assigned to" : "unassigned from"} geofence successfully`,
    result,
    statusCode.OK
  );
});

/**
 * Controller: Get geofences assigned to a specific employee
 */
export const getEmployeeGeofences = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = employeeGeofencesParamSchema.parse({ params: req.params });
  const result = await geofenceService.getGeofencesForEmployee(params.employeeId, organizationId);
  return SuccessResponse(res, "Employee geofences retrieved successfully", result, statusCode.OK);
});
