import { labourRatingRepo } from "../repos/labour-rating.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateLabourRatingInput,
  UpdateLabourRatingInput,
  GetLabourRatingsQuery,
} from "../validators/labour-rating.validator.js";

/**
 * Labour Rating Service
 * Performance review scoring and booking feedback.
 */
export class LabourRatingService {
  /**
   * Create rating
   */
  async createRating(payload: CreateLabourRatingInput, organizationId: string) {
    const labour = await labourRepo.findById(payload.labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    const booking = await labourBookingRepo.findById(payload.bookingId, organizationId);
    if (!booking) {
      throw new ErrorResponse("Labour booking not found or unauthorized", statusCode.Not_Found);
    }

    return labourRatingRepo.create(payload);
  }

  /**
   * Get rating by ID
   */
  async getRatingById(id: string, organizationId: string) {
    const rating = await labourRatingRepo.findById(id, organizationId);
    if (!rating) {
      throw new ErrorResponse("Labour rating not found or unauthorized", statusCode.Not_Found);
    }
    return rating;
  }

  /**
   * Get all ratings
   */
  async getRatings(query: GetLabourRatingsQuery, organizationId: string) {
    return labourRatingRepo.findAll(query, organizationId);
  }

  /**
   * Update rating
   */
  async updateRating(id: string, payload: UpdateLabourRatingInput, organizationId: string) {
    await this.getRatingById(id, organizationId);
    return labourRatingRepo.update(id, payload);
  }

  /**
   * Delete rating
   */
  async deleteRating(id: string, organizationId: string) {
    await this.getRatingById(id, organizationId);
    return labourRatingRepo.delete(id);
  }
}

export const labourRatingService = new LabourRatingService();
