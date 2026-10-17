import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourBookingService } from "../services/labour-booking.service.js";
import {
  createLabourBookingSchema,
  createMarketplaceBookingSchema,
  createServiceBookingSchema,
  checkAvailabilityQuerySchema,
  manualAssignLabourSchema,
  platformLabourSettingSchema,
  updateLabourBookingSchema,
  updateBookingStatusSchema,
  rejectBookingSchema,
  submitQuoteSchema,
  respondQuoteSchema,
  completeWorkSchema,
  confirmCompletionSchema,
  reportDelaySchema,
  reassignLabourSchema,
  bookingIdParamSchema,
  getLabourBookingsQuerySchema,
} from "../validators/labour-booking.validator.js";

/**
 * @route   POST /api/v1/labour/bookings
 * @desc    Create a new labour project booking / assignment (B2B Org Channel)
 * @access  Private (Authenticated Tenant User)
 */
export const createLabourBooking = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLabourBookingSchema.parse({ body: req.body });
  const result = await labourBookingService.createBooking(parsed.body, organizationId);
  return SuccessResponse(res, "Labour booking created successfully", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/bookings/marketplace
 * @desc    Create a new direct marketplace service booking (B2C User/Client Channel)
 * @access  Private (Authenticated Client/Homeowner)
 */
export const createMarketplaceBooking = asyncHandler(async (req, res) => {
  const clientId = req.user?.id;
  if (!clientId) {
    throw new ErrorResponse("Authentication required to request service booking", statusCode.Unauthorized);
  }

  const parsed = createMarketplaceBookingSchema.parse({ body: req.body });
  const result = await labourBookingService.createMarketplaceBooking(parsed.body, clientId);
  return SuccessResponse(res, "Marketplace service booking requested successfully", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/bookings/service-request
 * @desc    Client requests on-demand service booking (fills only workTitle, startDate, endDate, description, specialInstructions, taskChecklist, state, city, category)
 * @access  Private (Authenticated Client/Homeowner)
 */
export const createServiceBooking = asyncHandler(async (req, res) => {
  const clientId = req.user?.id;
  if (!clientId) {
    throw new ErrorResponse("Authentication required to request service booking", statusCode.Unauthorized);
  }

  const parsed = createServiceBookingSchema.parse({ body: req.body });
  const result = await labourBookingService.createServiceBooking(parsed.body, clientId);
  const message =
    result.assignedMode === "AUTO"
      ? `${result.count} service booking(s) created and labour worker(s) assigned automatically`
      : `${result.count} service booking(s) requested successfully. Awaiting platform manual worker assignment.`;

  return SuccessResponse(res, message, result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/bookings/check-availability
 * @desc    Pre-check availability & cooldown for client before requesting service booking
 * @access  Private (Authenticated Client/Homeowner)
 */
export const checkLabourAvailability = asyncHandler(async (req, res) => {
  const parsed = checkAvailabilityQuerySchema.parse({ query: req.query });
  const result = await labourBookingService.checkAvailability(parsed.query, req.user?.id);
  return SuccessResponse(res, "Availability checked successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/accept
 * @desc    Assigned labour worker accepts the booking request
 * @access  Private (Assigned Labour Worker / Admin)
 */
export const acceptLabourBooking = asyncHandler(async (req, res) => {
  const parsedParams = bookingIdParamSchema.parse({ params: req.params });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.acceptBooking(parsedParams.params.id, {
    id: req.user!.id,
    userType: req.user?.userType,
    isPlatformAdmin,
  });

  return SuccessResponse(res, "Service booking accepted successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/reject
 * @desc    Assigned labour worker rejects the booking request
 * @access  Private (Assigned Labour Worker / Admin)
 */
export const rejectLabourBooking = asyncHandler(async (req, res) => {
  const parsed = rejectBookingSchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.rejectBooking(
    parsed.params.id,
    {
      id: req.user!.id,
      userType: req.user?.userType,
      isPlatformAdmin,
    },
    parsed.body
  );

  return SuccessResponse(res, "Service booking rejected successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/bookings/:id/quote
 * @desc    Labour worker submits on-site deal quotation
 * @access  Private (Assigned Labour Worker / Admin)
 */
export const submitLabourBookingQuote = asyncHandler(async (req, res) => {
  const parsed = submitQuoteSchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.submitQuote(
    parsed.params.id,
    {
      id: req.user!.id,
      userType: req.user?.userType,
      isPlatformAdmin,
    },
    parsed.body
  );

  return SuccessResponse(res, "Deal quotation submitted successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/quote-response
 * @desc    Client accepts or rejects on-site deal quotation
 * @access  Private (Booking Client / Admin)
 */
export const respondLabourBookingQuote = asyncHandler(async (req, res) => {
  const parsed = respondQuoteSchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";
  const accept = parsed.body.accept ?? parsed.body.accepted ?? false;

  const result = await labourBookingService.respondQuote(
    parsed.params.id,
    req.user!.id,
    {
      accept,
      rejectionReason: parsed.body.rejectionReason,
    },
    isPlatformAdmin
  );

  const message = accept ? "Quotation accepted and work commenced" : "Quotation rejected";
  return SuccessResponse(res, message, result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/complete-work
 * @desc    Labour worker submits task checklist and proof photos upon work completion
 * @access  Private (Assigned Labour Worker / Admin)
 */
export const completeLabourBookingWork = asyncHandler(async (req, res) => {
  const parsed = completeWorkSchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.completeWork(
    parsed.params.id,
    {
      id: req.user!.id,
      isPlatformAdmin,
    },
    parsed.body
  );

  return SuccessResponse(res, "Work completion submitted with proof photos", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/confirm-completion
 * @desc    Client verifies completed work and leaves rating/review
 * @access  Private (Booking Client / Admin)
 */
export const confirmLabourBookingCompletion = asyncHandler(async (req, res) => {
  const parsed = confirmCompletionSchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.confirmCompletion(
    parsed.params.id,
    req.user!.id,
    parsed.body,
    isPlatformAdmin
  );

  return SuccessResponse(res, "Booking completed and rating recorded", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/settle-commission
 * @desc    Settle platform commission payment
 * @access  Private (Platform Admin / Finance)
 */
export const settleLabourBookingCommission = asyncHandler(async (req, res) => {
  const parsedParams = bookingIdParamSchema.parse({ params: req.params });
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";

  const result = await labourBookingService.settleCommission(parsedParams.params.id, isPlatformAdmin);
  return SuccessResponse(res, "Platform commission settled successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/bookings/:id/report-delay
 * @desc    Client reports labour worker arrival delay after 24 hours
 * @access  Private (Booking Client / Admin)
 */
export const reportLabourBookingDelay = asyncHandler(async (req, res) => {
  const parsed = reportDelaySchema.parse({ params: req.params, body: req.body });
  const isPlatformAdmin = (req.user?.userType as string) === "PLATFORM_ADMIN";

  const result = await labourBookingService.reportDelay(
    parsed.params.id,
    req.user!.id,
    parsed.body,
    isPlatformAdmin
  );

  return SuccessResponse(res, "Arrival delay reported and escalated for reassignment", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/bookings/:id/reassign
 * @desc    Platform Admin manually reassigns replacement worker for delayed service booking
 * @access  Private (Platform Admin / Support)
 */
export const reassignLabourBooking = asyncHandler(async (req, res) => {
  const parsed = reassignLabourSchema.parse({ params: req.params, body: req.body });

  const result = await labourBookingService.reassignLabour(
    parsed.params.id,
    parsed.body,
    req.user!.id
  );

  return SuccessResponse(res, "Replacement labour successfully reassigned for service booking", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/bookings
 * @desc    Fetch paginated labour bookings with search & status filters across Org and Marketplace
 * @access  Private (Authenticated User - Org, Client, Worker, or Platform Admin)
 */
export const getAllLabourBookings = asyncHandler(async (req, res) => {
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
    scope.workerUserId = req.user!.id;
  } else if (userType === "USER" || !req.user?.organizationId) {
    scope.clientId = req.user!.id;
  } else {
    scope.organizationId = req.user?.organizationId;
  }

  const result = await labourBookingService.getBookings(parsed.query, scope);
  return SuccessResponse(res, "Labour bookings retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/bookings/:id
 * @desc    Get detailed booking profile with labour, project, and financial summaries
 * @access  Private (Authenticated User - Org, Client, Worker, or Platform Admin)
 */
export const getLabourBookingById = asyncHandler(async (req, res) => {
  const parsed = bookingIdParamSchema.parse({ params: req.params });

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
    scope.workerUserId = req.user!.id;
  } else if (userType === "USER" || !req.user?.organizationId) {
    scope.clientId = req.user!.id;
  } else {
    scope.organizationId = req.user?.organizationId;
  }

  const result = await labourBookingService.getBookingById(parsed.params.id, scope);
  return SuccessResponse(res, "Labour booking retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/bookings/:id
 * @desc    Full symmetric update of labour booking (Rule 19)
 * @access  Private (Authenticated Tenant User / Admin)
 */
export const updateLabourBooking = asyncHandler(async (req, res) => {
  const isPlatformAdmin = req.user?.userType === "PLATFORM_ADMIN";
  const userType = req.user?.userType as string | undefined;
  const scope: {
    organizationId?: string | null;
    clientId?: string | null;
    isPlatformAdmin?: boolean;
  } = {};

  if (isPlatformAdmin) {
    scope.isPlatformAdmin = true;
  } else if (userType === "USER" || !req.user?.organizationId) {
    scope.clientId = req.user!.id;
  } else {
    scope.organizationId = req.user?.organizationId;
  }

  const parsed = updateLabourBookingSchema.parse({ params: req.params, body: req.body });
  const result = await labourBookingService.updateBooking(parsed.params.id, parsed.body, scope);
  return SuccessResponse(res, "Labour booking updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/status
 * @desc    Update labour booking status (CONFIRMED, IN_PROGRESS, COMPLETED, etc.)
 * @access  Private (Authenticated Tenant User / Admin)
 */
export const updateLabourBookingStatus = asyncHandler(async (req, res) => {
  const isPlatformAdmin = (req.user?.userType as string) === "PLATFORM_ADMIN";
  const organizationId = isPlatformAdmin ? undefined : (req.user?.organizationId || undefined);
  const parsed = updateBookingStatusSchema.parse({ params: req.params, body: req.body });
  const result = await labourBookingService.updateStatus(
    parsed.params.id,
    parsed.body.status,
    organizationId,
    isPlatformAdmin
  );
  return SuccessResponse(res, "Labour booking status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/bookings/:id
 * @desc    Soft delete labour booking
 * @access  Private (Authenticated Tenant User / Admin)
 */
export const deleteLabourBooking = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId || undefined;
  const parsed = bookingIdParamSchema.parse({ params: req.params });
  await labourBookingService.deleteBooking(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour booking deleted successfully", null, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/bookings/:id/manual-assign
 * @desc    Platform Admin manually assigns labour worker to pending/delayed service booking
 * @access  Private (Platform Admin)
 */
export const manualAssignLabourBooking = asyncHandler(async (req, res) => {
  const parsed = manualAssignLabourSchema.parse({ params: req.params, body: req.body });
  const result = await labourBookingService.manualAssignLabour(
    parsed.params.id,
    parsed.body,
    req.user!.id
  );
  return SuccessResponse(res, "Labour worker successfully assigned to service booking", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/platform/labours/settings
 * @desc    Fetch platform labour assignment settings (Auto-Assign toggle & thresholds)
 * @access  Private (Platform Admin)
 */
export const getPlatformLabourSettings = asyncHandler(async (req, res) => {
  const result = await labourBookingService.getPlatformSettings();
  return SuccessResponse(res, "Platform labour settings retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/platform/labours/settings
 * @desc    Update platform labour assignment settings (Toggle auto-assign ON/OFF)
 * @access  Private (Platform Admin)
 */
export const updatePlatformLabourSettings = asyncHandler(async (req, res) => {
  const parsed = platformLabourSettingSchema.parse({ body: req.body });
  const result = await labourBookingService.updatePlatformSettings(parsed.body, req.user?.id);
  return SuccessResponse(res, "Platform labour settings updated successfully", result, statusCode.OK);
});

