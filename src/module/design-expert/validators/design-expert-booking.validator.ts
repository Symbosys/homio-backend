import { z } from "zod";
import { ExpertBookingStatus, ExpertPaymentStatus } from "../../../types/types.js";

/**
 * Validation schema for querying paginated bookings (Platform Admin)
 * @route GET /api/v1/design-experts/bookings
 * @access PLATFORM_ADMIN
 */
export const GetBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  expertId: z.string().uuid("Invalid expert ID").optional(),
  userId: z.string().uuid("Invalid user ID").optional(),
  status: z.nativeEnum(ExpertBookingStatus).optional(),
  paymentStatus: z.nativeEnum(ExpertPaymentStatus).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().trim().optional(),
});

export type GetBookingsQuery = z.infer<typeof GetBookingsQuerySchema>;

/**
 * Validation schema for platform editing booking details (rescheduling, updating link, topic)
 * @route PATCH /api/v1/design-experts/bookings/:id
 * @access PLATFORM_ADMIN
 */
export const PlatformEditBookingSchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Start time must be HH:mm").optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "End time must be HH:mm").optional(),
  meetingUrl: z.string().trim().url("Invalid meeting URL format").optional().or(z.literal("")),
  topic: z.string().trim().optional(),
  propertyType: z.string().trim().optional(),
  requirements: z.string().trim().optional(),
  additionalInformation: z.record(z.string(), z.any()).optional(),
}).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.startTime < data.endTime;
    }
    return true;
  },
  {
    message: "Start time must be earlier than end time",
    path: ["endTime"],
  }
);

export type PlatformEditBookingInput = z.infer<typeof PlatformEditBookingSchema>;

/**
 * Validation schema for cancelling a booking (Platform Admin)
 * @route PATCH /api/v1/design-experts/bookings/:id/cancel
 * @access PLATFORM_ADMIN
 */
export const PlatformCancelBookingSchema = z.object({
  reason: z.string().trim().min(3, "Cancellation reason is required"),
});

export type PlatformCancelBookingInput = z.infer<typeof PlatformCancelBookingSchema>;

/**
 * Validation schema for submitting post-session rating and review (Client)
 * @route POST /api/v1/design-experts/bookings/:id/review
 * @access Authenticated Client
 */
export const SubmitReviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  reviewComment: z.string().trim().optional(),
});

export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;
