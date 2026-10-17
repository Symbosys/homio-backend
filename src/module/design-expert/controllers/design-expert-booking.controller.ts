import type { Request, Response, NextFunction } from "express";
import { DesignExpertBookingService } from "../services/design-expert-booking.service.js";
import {
  GetBookingsQuerySchema,
  PlatformEditBookingSchema,
  PlatformCancelBookingSchema,
  SubmitReviewSchema,
} from "../validators/design-expert-booking.validator.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";

const service = new DesignExpertBookingService();

/**
 * @route   GET /api/v1/design-experts/bookings
 * @desc    Get paginated bookings with date, status, expert, and client filters
 * @access  PLATFORM_ADMIN
 */
export const getBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedQuery = GetBookingsQuerySchema.parse(req.query);
    const result = await service.getBookings(validatedQuery);
    return SuccessResponse(res, "Bookings retrieved successfully", result);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/design-experts/bookings/:id
 * @desc    Get single booking details
 * @access  PLATFORM_ADMIN / Client
 */
export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const booking = await service.getBookingById(id);
    return SuccessResponse(res, "Booking details retrieved successfully", booking);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id
 * @desc    Platform Admin edit booking details (reschedule date/time, update link, topic)
 * @access  PLATFORM_ADMIN
 */
export const platformEditBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = PlatformEditBookingSchema.parse(req.body);
    const updated = await service.platformEditBooking(id, validatedData);
    return SuccessResponse(res, "Booking details updated successfully", updated);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id/cancel
 * @desc    Platform Admin cancel booking
 * @access  PLATFORM_ADMIN
 */
export const platformCancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { reason } = PlatformCancelBookingSchema.parse(req.body);
    const result = await service.platformCancelBooking(id, reason);
    return SuccessResponse(res, result.message, result.data);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id/complete
 * @desc    Platform Admin mark booking complete post-call
 * @access  PLATFORM_ADMIN
 */
export const platformCompleteBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await service.platformCompleteBooking(id);
    return SuccessResponse(res, result.message, result.data);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/design-experts/bookings/:id/review
 * @desc    Client submit post-session 1-5 star rating and comment
 * @access  Authenticated Client
 */
export const submitReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { rating, reviewComment } = SubmitReviewSchema.parse(req.body);

    if (!req.user) {
      throw new ErrorResponse("Authentication required to submit review", statusCode.Unauthorized);
    }

    const result = await service.submitReview(id, req.user.id, rating, reviewComment);
    return SuccessResponse(res, result.message, result.data);
  } catch (err) {
    next(err);
  }
};
