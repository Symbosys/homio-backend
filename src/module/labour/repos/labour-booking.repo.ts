import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourBookingsQuery } from "../validators/labour-booking.validator.js";

/**
 * Labour Booking Repository
 * Handles tenant-isolated DB operations for labour bookings/assignments under Project Services.
 */
export class LabourBookingRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Generates next booking number (e.g. LB-2026-0001) for a project
   */
  async generateBookingNumber(projectId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const count = await prisma.labourBooking.count({
      where: { projectId },
    });
    return `LB-${currentYear}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Create new booking
   */
  async create(data: any) {
    const formattedData = {
      ...data,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };
    return prisma.labourBooking.create({
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            skillLevel: true,
            photoUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find booking by ID with tenant verification
   */
  async findById(id: string, organizationId: string) {
    return prisma.labourBooking.findFirst({
      where: {
        id,
        isDeleted: false,
        project: { organizationId },
      },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            skillLevel: true,
            photoUrl: true,
            dailyRate: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
            location: true,
          },
        },
        _count: {
          select: {
            attendances: true,
            payments: true,
            ratings: true,
            disputes: true,
          },
        },
      },
    });
  }

  /**
   * List paginated bookings with filters
   */
  async findAll(query: GetLabourBookingsQuery, organizationId: string) {
    const { page, limit, projectId, projectServiceId, labourId, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourBookingWhereInput = {
      isDeleted: false,
      project: { organizationId },
      ...(projectId && { projectId }),
      ...(projectServiceId && { projectServiceId }),
      ...(labourId && { labourId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { bookingNumber: { contains: search, mode: "insensitive" } },
          { workTitle: { contains: search, mode: "insensitive" } },
          { labour: { name: { contains: search, mode: "insensitive" } } },
          { projectService: { title: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [total, bookings] = await Promise.all([
      prisma.labourBooking.count({ where }),
      prisma.labourBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
            },
          },
          projectService: {
            select: {
              id: true,
              serviceCode: true,
              title: true,
              category: true,
              status: true,
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
      bookings,
    };
  }

  /**
   * Update booking
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourBooking.update({
      where: { id },
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
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete booking
   */
  async softDelete(id: string) {
    return prisma.labourBooking.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const labourBookingRepo = new LabourBookingRepo();
