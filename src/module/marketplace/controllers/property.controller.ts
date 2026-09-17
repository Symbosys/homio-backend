import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { propertyService } from "../services/property.service.js";
import {
  createPropertySchema,
  updatePropertySchema,
  updatePropertyVerificationSchema,
  getPropertiesQuerySchema,
  propertyIdParamSchema,
} from "../validators/property.validator.js";

/**
 * Org Admin: Create real estate property listing
 */
export const createProperty = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to create a property listing", statusCode.Forbidden);
  }

  const parsed = createPropertySchema.parse({ body: req.body });
  const property = await propertyService.createProperty(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Property listing created successfully", property, statusCode.Created);
});

/**
 * Public: List properties (filterable by organizationId, city, bhk, etc.)
 */
export const getProperties = asyncHandler(async (req, res) => {
  const parsed = getPropertiesQuerySchema.parse({ query: req.query });
  const organizationId = parsed.query.organizationId;
  const isOwnerOrAdmin = (req.user?.userType === "ADMIN" && req.user.organizationId === organizationId) || req.user?.userType === "PLATFORM_ADMIN";

  const result = await propertyService.getProperties(
    {
      ...parsed.query,
      organizationId,
    },
    isOwnerOrAdmin
  );
  return SuccessResponse(res, "Properties retrieved successfully", result, statusCode.OK);
});

/**
 * Authenticated: Get single property details
 */
export const getPropertyById = asyncHandler(async (req, res) => {
  const parsed = propertyIdParamSchema.parse({ params: req.params });
  const isOwnerOrAdmin = req.user?.userType === "ADMIN" || req.user?.userType === "PLATFORM_ADMIN";

  const property = await propertyService.getPropertyById(parsed.params.id, undefined, isOwnerOrAdmin);
  return SuccessResponse(res, "Property details retrieved successfully", property, statusCode.OK);
});

/**
 * Org Admin: Update property listing
 */
export const updateProperty = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updatePropertySchema.parse({ params: req.params, body: req.body });
  const property = await propertyService.updateProperty(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Property listing updated successfully", property, statusCode.OK);
});

/**
 * Platform Admin: Update Homio verification status
 */
export const updatePropertyVerification = asyncHandler(async (req, res) => {
  const parsed = updatePropertyVerificationSchema.parse({ params: req.params, body: req.body });
  const property = await propertyService.updateVerificationStatus(parsed.params.id, parsed.body.verificationStatus);
  return SuccessResponse(res, "Property verification status updated successfully", property, statusCode.OK);
});

/**
 * Org Admin: Soft-delete property listing
 */
export const deleteProperty = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = propertyIdParamSchema.parse({ params: req.params });
  await propertyService.deleteProperty(parsed.params.id, organizationId);
  return SuccessResponse(res, "Property listing deleted successfully", {}, statusCode.OK);
});
