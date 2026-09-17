import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { vendorService } from "../services/vendor.service.js";
import {
  createVendorSchema,
  updateVendorSchema,
  getVendorsQuerySchema,
  vendorIdParamSchema,
} from "../validators/vendor.validator.js";

/**
 * Org Admin: Create a vendor
 */
export const createVendor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to create a vendor", statusCode.Forbidden);
  }

  const parsed = createVendorSchema.parse({ body: req.body });
  const vendor = await vendorService.createVendor(organizationId, parsed.body);
  return SuccessResponse(res, "Vendor created successfully", vendor, statusCode.Created);
});

/**
 * Org Admin: Get paginated vendors list
 */
export const getVendors = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to retrieve vendors", statusCode.Forbidden);
  }

  const parsed = getVendorsQuerySchema.parse({ query: req.query });
  const result = await vendorService.getVendors(organizationId, parsed.query);
  return SuccessResponse(res, "Vendors retrieved successfully", result, statusCode.OK);
});

/**
 * Org Admin: Get single vendor by ID
 */
export const getVendorById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = vendorIdParamSchema.parse({ params: req.params });
  const vendor = await vendorService.getVendorById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Vendor details retrieved successfully", vendor, statusCode.OK);
});

/**
 * Org Admin: Update vendor
 */
export const updateVendor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateVendorSchema.parse({ params: req.params, body: req.body });
  const vendor = await vendorService.updateVendor(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Vendor updated successfully", vendor, statusCode.OK);
});

/**
 * Org Admin: Soft-delete vendor
 */
export const deleteVendor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = vendorIdParamSchema.parse({ params: req.params });
  await vendorService.deleteVendor(parsed.params.id, organizationId);
  return SuccessResponse(res, "Vendor deleted successfully", {}, statusCode.OK);
});
