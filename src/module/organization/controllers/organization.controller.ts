import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { organizationService } from "../services/organization.service.js";
import {
  onboardOrganizationSchema,
  updateOrganizationSchema,
  updateOrgStatusSchema,
  assignSubscriptionSchema,
  orgIdParamSchema,
  getOrganizationsQuerySchema,
} from "../validators/organization.validator.js";

/**
 * Controller: Onboard organization with subscription and optional initial admin user (PLATFORM_ADMIN)
 */
export const onboardOrganization = asyncHandler(async (req, res) => {
  const parsed = onboardOrganizationSchema.parse({ body: req.body });
  const result = await organizationService.onboardOrganization(parsed.body, req.file);
  return SuccessResponse(res, "Organization onboarded successfully", result, statusCode.Created);
});

/**
 * Controller: Get all organizations with pagination (PLATFORM_ADMIN)
 */
export const getAllOrganizations = asyncHandler(async (req, res) => {
  const parsed = getOrganizationsQuerySchema.parse({ query: req.query });
  const result = await organizationService.getAllOrganizations(parsed.query);
  return SuccessResponse(res, "Organizations retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single organization by ID (PLATFORM_ADMIN)
 */
export const getOrganizationById = asyncHandler(async (req, res) => {
  const parsed = orgIdParamSchema.parse({ params: req.params });
  const org = await organizationService.getOrganizationById(parsed.params.id);
  return SuccessResponse(res, "Organization details retrieved successfully", org, statusCode.OK);
});

/**
 * Controller: Update organization profile details (PLATFORM_ADMIN)
 */
export const updateOrganization = asyncHandler(async (req, res) => {
  const parsed = updateOrganizationSchema.parse({ params: req.params, body: req.body });
  const updated = await organizationService.updateOrganization(parsed.params.id, parsed.body, req.file);
  return SuccessResponse(res, "Organization updated successfully", updated, statusCode.OK);
});

/**
 * Controller: Update organization status e.g. SUSPENDED, ACTIVE (PLATFORM_ADMIN)
 */
export const updateOrganizationStatus = asyncHandler(async (req, res) => {
  const parsed = updateOrgStatusSchema.parse({ params: req.params, body: req.body });
  const updated = await organizationService.updateOrganizationStatus(parsed.params.id, parsed.body.status);
  return SuccessResponse(res, "Organization status updated successfully", updated, statusCode.OK);
});

/**
 * Controller: Assign / change organization subscription plan (PLATFORM_ADMIN)
 */
export const assignSubscription = asyncHandler(async (req, res) => {
  const parsed = assignSubscriptionSchema.parse({ params: req.params, body: req.body });
  const subscription = await organizationService.assignSubscription(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Subscription plan assigned successfully", subscription, statusCode.OK);
});
