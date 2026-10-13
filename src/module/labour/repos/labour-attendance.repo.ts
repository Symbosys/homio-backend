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
  async findByUniqueDate(projectSiteId: string | null | undefined, labourId: string, attendanceDate: Date) {
    return prisma.labourAttendance.findFirst({
      where: {
        ...(projectSiteId ? { projectSiteId } : {}),
        labourId,
        attendanceDate,
      },
      include: {
        booking: true,
        projectSite: true,
      },
    });
  }

  /**
   * Find currently active punched-in shift for worker
   */
  async findActivePunchedIn(labourId: string, bookingId?: string) {
    return prisma.labourAttendance.findFirst({
      where: {
        labourId,
        ...(bookingId ? { bookingId } : {}),
        punchInTime: { not: null },
        punchOutTime: null,
      },
      include: {
        booking: {
          include: {
            project: { include: { site: true } },
            client: true,
          },
        },
        projectSite: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find today's attendance record for specific booking
   */
  async findTodayAttendanceByBooking(labourId: string, bookingId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return prisma.labourAttendance.findFirst({
      where: {
        labourId,
        bookingId,
        attendanceDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        booking: true,
        projectSite: true,
      },
      orderBy: { createdAt: "desc" },
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
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            agreedDailyRate: true,
            status: true,
            latitude: true,
            longitude: true,
            geofenceRadius: true,
            isStrictGeofence: true,
            serviceAddress: true,
            locality: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  /**
   * Find attendance by ID with flexible scoping (Org, Worker, or Platform Admin)
   */
  async findById(
    id: string,
    scope?:
      | string
      | null
      | {
          organizationId?: string | null;
          workerUserId?: string | null;
          labourId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const normalizedScope = typeof scope === "string" ? { organizationId: scope } : scope;

    const where: Prisma.LabourAttendanceWhereInput = { id };

    if (normalizedScope && !normalizedScope.isPlatformAdmin) {
      if (normalizedScope.organizationId) {
        where.OR = [
          { labour: { organizationId: normalizedScope.organizationId } },
          { booking: { organizationId: normalizedScope.organizationId } },
        ];
      }
      if (normalizedScope.workerUserId) {
        where.labour = { userId: normalizedScope.workerUserId };
      }
      if (normalizedScope.labourId) {
        where.labourId = normalizedScope.labourId;
      }
    }

    return prisma.labourAttendance.findFirst({
      where,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            dailyRate: true,
            photoUrl: true,
            userId: true,
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
            status: true,
            latitude: true,
            longitude: true,
            geofenceRadius: true,
            isStrictGeofence: true,
            serviceAddress: true,
            locality: true,
            city: true,
            state: true,
          },
        },
      },
    });
  }

  /**
   * Find all paginated attendance records with flexible filters across roles
   */
  async findAll(
    query: GetAttendancesQuery,
    scope?:
      | string
      | null
      | {
          organizationId?: string | null;
          workerUserId?: string | null;
          labourId?: string | null;
          clientId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const {
      page,
      limit,
      search,
      projectSiteId,
      labourId,
      bookingId,
      status,
      startDate,
      endDate,
      supervisorApproved,
    } = query;
    const skip = (page - 1) * limit;

    const normalizedScope = typeof scope === "string" ? { organizationId: scope } : scope;
    const where: Prisma.LabourAttendanceWhereInput = {
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

    if (normalizedScope && !normalizedScope.isPlatformAdmin) {
      if (normalizedScope.organizationId) {
        where.OR = [
          { labour: { organizationId: normalizedScope.organizationId } },
          { booking: { organizationId: normalizedScope.organizationId } },
        ];
      }
      if (normalizedScope.workerUserId) {
        where.labour = { userId: normalizedScope.workerUserId };
      }
      if (normalizedScope.labourId) {
        where.labourId = normalizedScope.labourId;
      }
      if (normalizedScope.clientId) {
        where.booking = { clientId: normalizedScope.clientId };
      }
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { labour: { name: { contains: search, mode: "insensitive" } } },
            { labour: { phone: { contains: search, mode: "insensitive" } } },
            { labour: { trade: { contains: search, mode: "insensitive" } } },
            { booking: { bookingNumber: { contains: search, mode: "insensitive" } } },
            { booking: { workTitle: { contains: search, mode: "insensitive" } } },
            { projectSite: { siteName: { contains: search, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const [total, attendances] = await Promise.all([
      prisma.labourAttendance.count({ where }),
      prisma.labourAttendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ attendanceDate: "desc" }, { createdAt: "desc" }],
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
              status: true,
              latitude: true,
              longitude: true,
              geofenceRadius: true,
              isStrictGeofence: true,
              serviceAddress: true,
              locality: true,
              city: true,
              state: true,
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
      items: attendances,
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
        booking: true,
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
