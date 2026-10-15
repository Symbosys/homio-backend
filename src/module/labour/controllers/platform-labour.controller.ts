import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourService } from "../services/labour.service.js";
import { labourBookingService } from "../services/labour-booking.service.js";
import {
  platformCreateLabourSchema,
  updateLabourSchema,
  platformGetLaboursQuerySchema,
  labourIdParamSchema,
  approveLabourSchema,
  rejectLabourSchema,
} from "../validators/labour.validator.js";
import { getLabourBookingsQuerySchema } from "../validators/labour-booking.validator.js";

/**
 * @route   POST /api/v1/platform/labours
 * @desc    Platform Admin: Create a labour profile (independent or assigned to a tenant organization)
 * @access  Private (PLATFORM_ADMIN)
 */
export const createLabour = asyncHandler(async (req, res) => {
  const parsed = platformCreateLabourSchema.parse({ body: req.body });
  const result = await labourService.createPlatformLabour(parsed.body, req.file, req.user?.id);
  return SuccessResponse(res, "Labour onboarded successfully by platform admin", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/platform/labours
 * @desc    Platform Admin: Fetch labours with flexible scoping (ALL, PLATFORM_ONLY, ORG_ONLY)
 * @access  Private (PLATFORM_ADMIN)
 */
export const getLabours = asyncHandler(async (req, res) => {
  const parsed = platformGetLaboursQuerySchema.parse({ query: req.query });
  const result = await labourService.getPlatformLabours(parsed.query);
  return SuccessResponse(res, "Platform labours retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/platform/labours/:id
 * @desc    Platform Admin: Fetch single labour profile across any organization or platform direct
 * @access  Private (PLATFORM_ADMIN)
 */
export const getLabourById = asyncHandler(async (req, res) => {
  const parsed = labourIdParamSchema.parse({ params: req.params });
  const result = await labourService.getPlatformLabourById(parsed.params.id);
  return SuccessResponse(res, "Labour details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/platform/labours/:id
 * @desc    Platform Admin: Update labour profile symmetrically
 * @access  Private (PLATFORM_ADMIN)
 */
export const updateLabour = asyncHandler(async (req, res) => {
  const parsed = updateLabourSchema.parse({ params: req.params, body: req.body });
  const result = await labourService.updatePlatformLabour(parsed.params.id, parsed.body, req.file, req.user?.id);
  return SuccessResponse(res, "Labour profile updated successfully by platform admin", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/platform/labours/:id
 * @desc    Platform Admin: Soft delete labour profile
 * @access  Private (PLATFORM_ADMIN)
 */
export const deleteLabour = asyncHandler(async (req, res) => {
  const parsed = labourIdParamSchema.parse({ params: req.params });
  await labourService.deletePlatformLabour(parsed.params.id);
  return SuccessResponse(res, "Labour profile deleted successfully by platform admin", null, statusCode.OK);
});

/**
 * @route   GET /api/v1/platform/labours/bookings
 * @desc    Fetch platform service / labour bookings with channel filter (ORGANIZATION_PROJECT vs PLATFORM_MARKETPLACE) and full date / status filters
 * @access  Private (PLATFORM_ADMIN, LABOUR, USER)
 */
export const getPlatformLabourBookings = asyncHandler(async (req, res) => {
  const parsed = getLabourBookingsQuerySchema.parse({ query: req.query });

  let scope: {
    organizationId?: string | null;
    clientId?: string | null;
    workerUserId?: string | null;
    isPlatformAdmin?: boolean;
  } = {};

  const userType = req.user?.userType as string | undefined;

  if (userType === "PLATFORM_ADMIN") {
    scope.isPlatformAdmin = true;
  } else if (userType === "LABOUR") {
    // Labour sees all their assigned bookings across Org and Marketplace
    scope.workerUserId = req.user!.id;
  } else if (userType === "USER" || !req.user?.organizationId) {
    scope.clientId = req.user!.id;
  } else {
    scope.organizationId = req.user?.organizationId;
  }

  const result = await labourBookingService.getBookings(parsed.query, scope);
  return SuccessResponse(
    res,
    "Platform service bookings retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/platform/labours/:id/approve
 * @desc    Platform Admin: Verify and approve a labour profile
 * @access  Private (PLATFORM_ADMIN)
 */
export const approveLabour = asyncHandler(async (req, res) => {
  const parsed = approveLabourSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await labourService.approveLabour(
    parsed.params.id,
    req.user!,
    parsed.body
  );
  return SuccessResponse(
    res,
    "Labour profile approved successfully and activated for work",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/platform/labours/:id/reject
 * @desc    Platform Admin: Reject a labour application with audit reason
 * @access  Private (PLATFORM_ADMIN)
 */
export const rejectLabour = asyncHandler(async (req, res) => {
  const parsed = rejectLabourSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await labourService.rejectLabour(
    parsed.params.id,
    req.user!,
    parsed.body
  );
  return SuccessResponse(
    res,
    "Labour application rejected",
    result,
    statusCode.OK
  );
});

