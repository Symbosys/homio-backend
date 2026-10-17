import { prisma } from "../../../lib/prisma.js";
import { Prisma, ExpertBookingStatus } from "../../../types/types.js";
import type {
  GetBookingsQuery,
  PlatformEditBookingInput,
} from "../validators/design-expert-booking.validator.js";

/**
 * Repository layer for Design Expert Bookings
 */
export class DesignExpertBookingRepo {
  /**
   * Helper to format JSON values safely for Prisma
   */
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Find booking by ID with full expert and client profile relations
   */
  async findById(id: string) {
    return prisma.designExpertBooking.findFirst({
      where: { id },
      include: {
        expert: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated bookings for Platform Admin with multi-field filters
   */
  async findAll(query: GetBookingsQuery) {
    const {
      page,
      limit,
      expertId,
      userId,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.DesignExpertBookingWhereInput = {
      isDeleted: false,
      ...(expertId ? { expertId } : {}),
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
      ...(startDate && endDate
        ? {
            bookingDate: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }
        : startDate
          ? { bookingDate: { gte: new Date(startDate) } }
          : endDate
            ? { bookingDate: { lte: new Date(endDate) } }
            : {}),
      ...(search
        ? {
            OR: [
              { bookingNumber: { contains: search, mode: "insensitive" } },
              { topic: { contains: search, mode: "insensitive" } },
              { expert: { name: { contains: search, mode: "insensitive" } } },
              { user: { firstName: { contains: search, mode: "insensitive" } } },
              { user: { lastName: { contains: search, mode: "insensitive" } } },
              { user: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.designExpertBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ bookingDate: "desc" }, { startTime: "desc" }],
        include: {
          expert: {
            select: {
              id: true,
              name: true,
              title: true,
              avatarUrl: true,
              consultationFee: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
      prisma.designExpertBooking.count({ where }),
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
   * Find all active (non-cancelled) bookings for an expert on a specific date
   * Used by the slot engine to subtract booked slots
   */
  async findActiveBookingsForDate(expertId: string, bookingDate: Date) {
    return prisma.designExpertBooking.findMany({
      where: {
        expertId,
        bookingDate,
        status: {
          not: ExpertBookingStatus.CANCELLED,
        },
        isDeleted: false,
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
      },
    });
  }

  /**
   * Check for slot collisions (double-booking guard)
   */
  async findConflictingBooking(
    expertId: string,
    bookingDate: Date,
    startTime: string,
    excludeBookingId?: string,
  ) {
    return prisma.designExpertBooking.findFirst({
      where: {
        expertId,
        bookingDate,
        startTime,
        status: {
          not: ExpertBookingStatus.CANCELLED,
        },
        isDeleted: false,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    });
  }

  /**
   * Update booking details (Platform edit)
   */
  async update(id: string, data: PlatformEditBookingInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.DesignExpertBookingUpdateInput = {};

    if (data.bookingDate !== undefined) {
      updateData.bookingDate = new Date(data.bookingDate);
    }
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.meetingUrl !== undefined) updateData.meetingUrl = data.meetingUrl || null;
    if (data.topic !== undefined) updateData.topic = data.topic || null;
    if (data.propertyType !== undefined) updateData.propertyType = data.propertyType || null;
    if (data.requirements !== undefined) updateData.requirements = data.requirements || null;
    if (data.additionalInformation !== undefined) {
      updateData.additionalInformation = this.formatJsonValue(data.additionalInformation);
    }

    return db.designExpertBooking.update({
      where: { id },
      data: updateData,
      include: {
        expert: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Cancel booking (Platform Admin)
   */
  async cancel(id: string, reason?: string) {
    return prisma.designExpertBooking.update({
      where: { id },
      data: {
        status: ExpertBookingStatus.CANCELLED,
        additionalInformation: reason ? { cancellationReason: reason } : undefined,
      },
    });
  }

  /**
   * Mark booking as completed post-session
   */
  async complete(id: string) {
    return prisma.designExpertBooking.update({
      where: { id },
      data: {
        status: ExpertBookingStatus.COMPLETED,
      },
    });
  }

  /**
   * Submit client rating & review
   */
  async submitReview(id: string, rating: number, comment?: string) {
    return prisma.designExpertBooking.update({
      where: { id },
      data: {
        rating,
        reviewComment: comment || null,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Create a booking record (Helper for seeding & future Razorpay hook)
   */
  async create(data: Prisma.DesignExpertBookingCreateInput) {
    return prisma.designExpertBooking.create({
      data,
    });
  }
}
