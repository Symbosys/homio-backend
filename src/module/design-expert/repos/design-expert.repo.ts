import { prisma } from "../../../lib/prisma.js";
import { Prisma, DayOfWeek, DesignExpertStatus } from "../../../types/types.js";
import type {
  CreateDesignExpertInput,
  UpdateDesignExpertInput,
  GetDesignExpertsQuery,
  SetWeeklyAvailabilityInput,
  AddDateOverrideInput,
} from "../validators/design-expert.validator.js";

/**
 * Repository layer for Design Expert entity and unified availability operations
 */
export class DesignExpertRepo {
  /**
   * Helper to format JSON values safely for Prisma
   */
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create a new Design Expert profile
   */
  async create(data: CreateDesignExpertInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designExpert.create({
      data: {
        name: data.name,
        title: data.title,
        qualification: data.qualification || null,
        experienceYears: data.experienceYears ?? 0,
        specialties: data.specialties ?? [],
        languages: data.languages ?? ["English", "Hindi"],
        bio: data.bio || null,
        avatarUrl: this.formatJsonValue(data.avatarUrl),
        phone: data.phone || null,
        email: data.email || null,
        defaultMeetingUrl: data.defaultMeetingUrl || null,
        consultationFee: new Prisma.Decimal(data.consultationFee ?? 0),
        slotDurationMinutes: data.slotDurationMinutes ?? 30,
        status: data.status ?? DesignExpertStatus.ACTIVE,
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      },
    });
  }

  /**
   * Find design expert by ID (excludes soft-deleted by default)
   */
  async findById(id: string, includeDeleted = false) {
    return prisma.designExpert.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        availabilities: {
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    });
  }

  /**
   * List design experts with search, filtering, and pagination
   */
  async findAll(query: GetDesignExpertsQuery) {
    const {
      page,
      limit,
      search,
      specialty,
      status,
      minRating,
      minExperience,
      sortBy,
      sortOrder,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.DesignExpertWhereInput = {
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(minRating ? { averageRating: { gte: minRating } } : {}),
      ...(minExperience ? { experienceYears: { gte: minExperience } } : {}),
      ...(specialty
        ? {
            specialties: {
              has: specialty,
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { bio: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.DesignExpertOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [items, total] = await Promise.all([
      prisma.designExpert.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      prisma.designExpert.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Partially update a design expert (Rule 5: Dirty payload)
   */
  async update(id: string, data: UpdateDesignExpertInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.DesignExpertUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.qualification !== undefined) updateData.qualification = data.qualification || null;
    if (data.experienceYears !== undefined) updateData.experienceYears = data.experienceYears;
    if (data.specialties !== undefined) updateData.specialties = data.specialties;
    if (data.languages !== undefined) updateData.languages = data.languages;
    if (data.bio !== undefined) updateData.bio = data.bio || null;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = this.formatJsonValue(data.avatarUrl);
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.defaultMeetingUrl !== undefined) updateData.defaultMeetingUrl = data.defaultMeetingUrl || null;
    if (data.consultationFee !== undefined) updateData.consultationFee = new Prisma.Decimal(data.consultationFee);
    if (data.slotDurationMinutes !== undefined) updateData.slotDurationMinutes = data.slotDurationMinutes;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.additionalInformation !== undefined) {
      updateData.additionalInformation = this.formatJsonValue(data.additionalInformation);
    }

    return db.designExpert.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft delete a design expert
   */
  async delete(id: string) {
    return prisma.designExpert.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        status: DesignExpertStatus.INACTIVE,
      },
    });
  }

  /**
   * Get all availability records (both weekly shifts and date overrides) for an expert
   */
  async getAvailability(expertId: string) {
    const [weeklyShifts, dateOverrides] = await Promise.all([
      prisma.designExpertAvailability.findMany({
        where: {
          expertId,
          specificDate: null,
          dayOfWeek: { not: null },
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      prisma.designExpertAvailability.findMany({
        where: {
          expertId,
          specificDate: { not: null },
        },
        orderBy: [{ specificDate: "asc" }],
      }),
    ]);

    return { weeklyShifts, dateOverrides };
  }

  /**
   * Replace all weekly recurring shifts for an expert in a clean transaction
   */
  async setWeeklyAvailability(expertId: string, input: SetWeeklyAvailabilityInput) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete existing weekly recurring shifts
      await tx.designExpertAvailability.deleteMany({
        where: {
          expertId,
          specificDate: null,
        },
      });

      // 2. Insert new weekly shifts
      if (input.shifts.length > 0) {
        await tx.designExpertAvailability.createMany({
          data: input.shifts.map((s) => ({
            expertId,
            dayOfWeek: s.dayOfWeek,
            specificDate: null,
            startTime: s.startTime,
            endTime: s.endTime,
            isAvailable: s.isAvailable,
            reason: s.reason || "Weekly Regular Shift",
          })),
        });
      }

      return tx.designExpertAvailability.findMany({
        where: { expertId, specificDate: null },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    });
  }

  /**
   * Add a date-specific override / leave (upserts by expertId + specificDate)
   */
  async addDateOverride(expertId: string, input: AddDateOverrideInput) {
    const dateObj = new Date(input.specificDate);

    // Delete existing override on this date if any
    await prisma.designExpertAvailability.deleteMany({
      where: {
        expertId,
        specificDate: dateObj,
      },
    });

    return prisma.designExpertAvailability.create({
      data: {
        expertId,
        dayOfWeek: null,
        specificDate: dateObj,
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        isAvailable: input.isAvailable,
        reason: input.reason || (input.isAvailable ? "Custom Hours" : "Leave / Blocked"),
      },
    });
  }

  /**
   * Delete a specific date override
   */
  async deleteDateOverride(expertId: string, overrideId: string) {
    return prisma.designExpertAvailability.deleteMany({
      where: {
        id: overrideId,
        expertId,
        specificDate: { not: null },
      },
    });
  }

  /**
   * Find specific date override for an expert on a given calendar date
   */
  async findDateOverride(expertId: string, date: Date) {
    return prisma.designExpertAvailability.findFirst({
      where: {
        expertId,
        specificDate: date,
      },
    });
  }

  /**
   * Find active weekly shifts for a specific DayOfWeek
   */
  async findDayOfWeekShifts(expertId: string, dayOfWeek: DayOfWeek) {
    return prisma.designExpertAvailability.findMany({
      where: {
        expertId,
        dayOfWeek,
        specificDate: null,
        isAvailable: true,
      },
      orderBy: { startTime: "asc" },
    });
  }

  /**
   * Recalculate average rating & counts for a design expert
   */
  async recalculateAggregateRating(expertId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const stats = await db.designExpertBooking.aggregate({
      where: {
        expertId,
        rating: { not: null },
      },
      _avg: {
        rating: true,
      },
      _count: {
        rating: true,
      },
    });

    const completedCount = await db.designExpertBooking.count({
      where: {
        expertId,
        status: "COMPLETED",
      },
    });

    const avg = stats._avg.rating ? Number(stats._avg.rating.toFixed(2)) : 5.0;
    const totalReviews = stats._count.rating || 0;

    await db.designExpert.update({
      where: { id: expertId },
      data: {
        averageRating: avg,
        totalReviewsCount: totalReviews,
        completedBookingsCount: completedCount,
      },
    });

    return { averageRating: avg, totalReviewsCount: totalReviews, completedBookingsCount: completedCount };
  }
}
