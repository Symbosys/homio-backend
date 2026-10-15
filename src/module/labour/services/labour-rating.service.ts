import { prisma } from "../../../lib/prisma.js";
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

  /**
   * Get worker ratings overview (aggregate scores, 5-star distribution, and paginated review list)
   */
  async getWorkerRatingsOverview(
    actor: { id: string; userType?: string; organizationId?: string | null },
    query: GetLabourRatingsQuery,
  ) {
    let targetLabourId = query.labourId;
    if (!targetLabourId) {
      const labour = await prisma.labour.findFirst({
        where: { userId: actor.id, isDeleted: false },
        select: { id: true, name: true, trade: true, averageRating: true, totalReviewsCount: true },
      });
      if (!labour) {
        throw new ErrorResponse(
          "No labour profile found linked to your account",
          statusCode.Not_Found,
        );
      }
      targetLabourId = labour.id;
    }

    const labourProfile = await prisma.labour.findUnique({
      where: { id: targetLabourId },
      select: { id: true, name: true, trade: true, averageRating: true, totalReviewsCount: true },
    });

    if (!labourProfile) {
      throw new ErrorResponse("Labour profile not found", statusCode.Not_Found);
    }

    // 1. Fetch all ratings for summary calculation
    const allRatings = await prisma.labourRating.findMany({
      where: { labourId: targetLabourId },
      select: {
        rating: true,
        qualityScore: true,
        punctualityScore: true,
        behaviourScore: true,
      },
    });

    const totalReviews = allRatings.length;
    const averageRating =
      totalReviews > 0
        ? Math.round(
            (allRatings.reduce((sum, r) => sum + r.rating, 0) / totalReviews) *
              10,
          ) / 10
        : Number(labourProfile.averageRating ?? 5.0);

    const starDistribution = {
      5: allRatings.filter((r) => Math.round(r.rating) === 5).length,
      4: allRatings.filter((r) => Math.round(r.rating) === 4).length,
      3: allRatings.filter((r) => Math.round(r.rating) === 3).length,
      2: allRatings.filter((r) => Math.round(r.rating) === 2).length,
      1: allRatings.filter((r) => Math.round(r.rating) === 1).length,
    };

    const qualityRatings = allRatings.filter((r) => r.qualityScore != null);
    const qualityAverage =
      qualityRatings.length > 0
        ? Math.round(
            (qualityRatings.reduce((sum, r) => sum + Number(r.qualityScore), 0) /
              qualityRatings.length) *
              10,
          ) / 10
        : 5.0;

    const punctualityRatings = allRatings.filter(
      (r) => r.punctualityScore != null,
    );
    const punctualityAverage =
      punctualityRatings.length > 0
        ? Math.round(
            (punctualityRatings.reduce(
              (sum, r) => sum + Number(r.punctualityScore),
              0,
            ) /
              punctualityRatings.length) *
              10,
          ) / 10
        : 5.0;

    const behaviourRatings = allRatings.filter((r) => r.behaviourScore != null);
    const behaviourAverage =
      behaviourRatings.length > 0
        ? Math.round(
            (behaviourRatings.reduce(
              (sum, r) => sum + Number(r.behaviourScore),
              0,
            ) /
              behaviourRatings.length) *
              10,
          ) / 10
        : 5.0;

    // 2. Fetch paginated list of reviews
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { labourId: targetLabourId };

    if (query.reviewerRole) {
      where.reviewerRole = query.reviewerRole;
    }
    if (query.minRating) {
      where.rating = { gte: query.minRating };
    }
    if (query.starRating) {
      where.rating = {
        gte: query.starRating - 0.49,
        lte: query.starRating + 0.5,
      };
    }

    const [total, items] = await Promise.all([
      prisma.labourRating.count({ where }),
      prisma.labourRating.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
              channel: true,
              locality: true,
              city: true,
              client: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      labour: {
        id: labourProfile.id,
        name: labourProfile.name,
        trade: labourProfile.trade,
        averageRating,
      },
      overall: {
        averageRating,
        totalReviews,
        starDistribution,
        qualityAverage,
        punctualityAverage,
        behaviourAverage,
      },
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const labourRatingService = new LabourRatingService();
