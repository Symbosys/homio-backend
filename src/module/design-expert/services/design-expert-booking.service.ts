import { DesignExpertBookingRepo } from "../repos/design-expert-booking.repo.js";
import { DesignExpertRepo } from "../repos/design-expert.repo.js";
import { ExpertBookingStatus, statusCode } from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type {
  GetBookingsQuery,
  PlatformEditBookingInput,
} from "../validators/design-expert-booking.validator.js";

/**
 * Service layer for Design Expert Bookings and Platform Administration
 */
export class DesignExpertBookingService {
  private bookingRepo = new DesignExpertBookingRepo();
  private expertRepo = new DesignExpertRepo();

  /**
   * List paginated bookings with filters for Platform Admin
   */
  async getBookings(query: GetBookingsQuery) {
    return this.bookingRepo.findAll(query);
  }

  /**
   * Get single booking details by ID
   */
  async getBookingById(id: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }
    return booking;
  }

  /**
   * Platform Edit Booking Details (reschedule date/time, update link, topic)
   * Includes atomic collision guard to prevent double-booking
   */
  async platformEditBooking(id: string, data: PlatformEditBookingInput) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (booking.status === ExpertBookingStatus.CANCELLED) {
      throw new ErrorResponse("Cannot edit a cancelled booking", statusCode.Bad_Request);
    }

    const targetDate = data.bookingDate ? new Date(data.bookingDate) : booking.bookingDate;
    const targetStartTime = data.startTime || booking.startTime;

    // If date or startTime is being changed, check for slot conflicts
    if (data.bookingDate || data.startTime) {
      const conflict = await this.bookingRepo.findConflictingBooking(
        booking.expertId,
        targetDate,
        targetStartTime,
        id, // Exclude current booking ID
      );

      if (conflict) {
        throw new ErrorResponse(
          `The expert is already booked for this slot (${targetStartTime}) on ${targetDate.toISOString().split("T")[0]}`,
          statusCode.Conflict,
        );
      }
    }

    return this.bookingRepo.update(id, data);
  }

  /**
   * Platform Cancel Booking
   */
  async platformCancelBooking(id: string, reason?: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (booking.status === ExpertBookingStatus.CANCELLED) {
      throw new ErrorResponse("Booking is already cancelled", statusCode.Bad_Request);
    }

    const updated = await this.bookingRepo.cancel(id, reason);
    return {
      success: true,
      message: "Booking cancelled successfully. Slot has been freed up.",
      data: updated,
    };
  }

  /**
   * Platform Mark Booking Complete post-call
   */
  async platformCompleteBooking(id: string) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (booking.status === ExpertBookingStatus.CANCELLED) {
      throw new ErrorResponse("Cannot complete a cancelled booking", statusCode.Bad_Request);
    }

    const updated = await this.bookingRepo.complete(id);

    // Update expert's completed count
    await this.expertRepo.recalculateAggregateRating(booking.expertId);

    return {
      success: true,
      message: "Booking marked as completed successfully.",
      data: updated,
    };
  }

  /**
   * Client Submit Post-Session Rating & Feedback
   */
  async submitReview(bookingId: string, userId: string, rating: number, comment?: string) {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    // Guard: Only the client who booked the session can review it
    if (booking.userId !== userId) {
      throw new ErrorResponse("You are not authorized to review this booking", statusCode.Forbidden);
    }

    // Guard: Must be completed
    if (booking.status !== ExpertBookingStatus.COMPLETED) {
      throw new ErrorResponse("Reviews can only be submitted for completed sessions", statusCode.Bad_Request);
    }

    const updated = await this.bookingRepo.submitReview(bookingId, rating, comment);

    // Recalculate expert's aggregate average rating
    await this.expertRepo.recalculateAggregateRating(booking.expertId);

    return {
      success: true,
      message: "Thank you! Your rating and feedback have been recorded.",
      data: updated,
    };
  }
}
