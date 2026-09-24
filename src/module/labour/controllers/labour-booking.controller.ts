import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourBookingService } from "../services/labour-booking.service.js";
import {
  createLabourBookingSchema,
  updateLabourBookingSchema,
  updateBookingStatusSchema,
  bookingIdParamSchema,
  getLabourBookingsQuerySchema,
} from "../validators/labour-booking.validator.js";

/**
 * @route   POST /api/v1/labour/bookings
 * @desc    Create a new labour project booking / assignment
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
 * @route   GET /api/v1/labour/bookings
 * @desc    Fetch paginated labour bookings with search & status filters
 * @access  Private (Authenticated Tenant User)
 */
export const getAllLabourBookings = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLabourBookingsQuerySchema.parse({ query: req.query });
  const result = await labourBookingService.getBookings(parsed.query, organizationId);
  return SuccessResponse(res, "Labour bookings retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/bookings/:id
 * @desc    Get detailed booking profile with labour, project, and financial summaries
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourBookingById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = bookingIdParamSchema.parse({ params: req.params });
  const result = await labourBookingService.getBookingById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour booking retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/bookings/:id
 * @desc    Full symmetric update of labour booking (Rule 19)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourBooking = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLabourBookingSchema.parse({ params: req.params, body: req.body });
  const result = await labourBookingService.updateBooking(parsed.params.id, parsed.body, organizationId);
  return SuccessResponse(res, "Labour booking updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/bookings/:id/status
 * @desc    Update labour booking status (CONFIRMED, IN_PROGRESS, COMPLETED, etc.)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourBookingStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateBookingStatusSchema.parse({ params: req.params, body: req.body });
  const result = await labourBookingService.updateStatus(parsed.params.id, parsed.body.status, organizationId);
  return SuccessResponse(res, "Labour booking status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/bookings/:id
 * @desc    Soft delete labour booking
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabourBooking = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = bookingIdParamSchema.parse({ params: req.params });
  await labourBookingService.deleteBooking(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour booking deleted successfully", null, statusCode.OK);
});
