import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourRatingsQuery } from "../validators/labour-rating.validator.js";

/**
 * Labour Rating Repository
 * Manages performance ratings and craftsmanship reviews for workers.
 */
export class LabourRatingRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create rating
   */
  async create(data: any) {
    const formattedData: any = {
      ...data,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourRating.create({
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find rating by ID with tenant verification
   */
  async findById(id: string, organizationId: string) {
    return prisma.labourRating.findFirst({
      where: {
        id,
        labour: { organizationId },
      },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            photoUrl: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List paginated ratings with filters
   */
  async findAll(query: GetLabourRatingsQuery, organizationId: string) {
    const { page, limit, labourId, bookingId, reviewerRole, minRating } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourRatingWhereInput = {
      labour: { organizationId },
      ...(labourId && { labourId }),
      ...(bookingId && { bookingId }),
      ...(reviewerRole && { reviewerRole }),
      ...(minRating && { rating: { gte: minRating } }),
    };

    const [total, ratings] = await Promise.all([
      prisma.labourRating.count({ where }),
      prisma.labourRating.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              trade: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      ratings,
    };
  }

  /**
   * Update rating
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourRating.update({
      where: { id },
      data: formattedData,
    });
  }

  /**
   * Delete rating
   */
  async delete(id: string) {
    return prisma.labourRating.delete({
      where: { id },
    });
  }
}

export const labourRatingRepo = new LabourRatingRepo();
