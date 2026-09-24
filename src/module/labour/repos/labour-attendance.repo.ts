import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetAttendancesQuery } from "../validators/labour-attendance.validator.js";

/**
 * Labour Attendance Repository
 * Manages daily attendance records, punch coordinates, selfie attachments, and calculations.
 */
export class LabourAttendanceRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Find attendance by unique compound key (projectSiteId, labourId, attendanceDate)
   */
  async findByUniqueDate(projectSiteId: string, labourId: string, attendanceDate: Date) {
    return prisma.labourAttendance.findUnique({
      where: {
        projectSiteId_labourId_attendanceDate: {
          projectSiteId,
          labourId,
          attendanceDate,
        },
      },
    });
  }

  /**
   * Create attendance record
   */
  async create(data: any) {
    const formattedData: any = {
      ...data,
      ...(data.punchInPhoto !== undefined && { punchInPhoto: this.formatJsonValue(data.punchInPhoto) }),
      ...(data.punchOutPhoto !== undefined && { punchOutPhoto: this.formatJsonValue(data.punchOutPhoto) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourAttendance.create({
      data: formattedData,
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
        projectSite: {
          select: {
            id: true,
            siteName: true,
            address: true,
            gpsLat: true,
            gpsLng: true,
            punchRadiusMeters: true,
            isPunchGeofenceStrict: true,
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
   * Find attendance by ID with tenant verification
   */
  async findById(id: string, organizationId: string) {
    return prisma.labourAttendance.findFirst({
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
            dailyRate: true,
            photoUrl: true,
          },
        },
        projectSite: {
          select: {
            id: true,
            siteName: true,
            address: true,
            gpsLat: true,
            gpsLng: true,
            punchRadiusMeters: true,
            isPunchGeofenceStrict: true,
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            agreedDailyRate: true,
          },
        },
      },
    });
  }

  /**
   * Find all paginated attendance records with filters
   */
  async findAll(query: GetAttendancesQuery, organizationId: string) {
    const { page, limit, projectSiteId, labourId, bookingId, status, startDate, endDate, supervisorApproved } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourAttendanceWhereInput = {
      labour: { organizationId },
      ...(projectSiteId && { projectSiteId }),
      ...(labourId && { labourId }),
      ...(bookingId && { bookingId }),
      ...(status && { status }),
      ...(supervisorApproved !== undefined && { supervisorApproved }),
      ...(startDate || endDate
        ? {
            attendanceDate: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [total, attendances] = await Promise.all([
      prisma.labourAttendance.count({ where }),
      prisma.labourAttendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { attendanceDate: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              phone: true,
              trade: true,
            },
          },
          projectSite: {
            select: {
              id: true,
              siteName: true,
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
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      attendances,
    };
  }

  /**
   * Update attendance record
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.punchInPhoto !== undefined && { punchInPhoto: this.formatJsonValue(data.punchInPhoto) }),
      ...(data.punchOutPhoto !== undefined && { punchOutPhoto: this.formatJsonValue(data.punchOutPhoto) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourAttendance.update({
      where: { id },
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Delete attendance record
   */
  async delete(id: string) {
    return prisma.labourAttendance.delete({
      where: { id },
    });
  }
}

export const labourAttendanceRepo = new LabourAttendanceRepo();
