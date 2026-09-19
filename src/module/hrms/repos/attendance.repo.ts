import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetAttendancesQueryInput,
  GetMyAttendanceQueryInput,
  RegularizeAttendanceInput,
} from "../validators/attendance.validator.js";

export class AttendanceRepository {
  /**
   * Find today's attendance record for an employee
   */
  async findByEmployeeAndDate(employeeId: string, organizationId: string, attendanceDate: Date) {
    return prisma.attendance.findFirst({
      where: {
        employeeId,
        organizationId,
        attendanceDate,
      },
      include: {
        shift: true,
        punchInGeofence: {
          select: { id: true, name: true, code: true, address: true, radiusMeters: true },
        },
        punchOutGeofence: {
          select: { id: true, name: true, code: true, address: true, radiusMeters: true },
        },
      },
    });
  }

  /**
   * Create punch in record
   */
  async createPunchIn(params: {
    organizationId: string;
    employeeId: string;
    attendanceDate: Date;
    shiftId?: string | null;
    punchInTime: Date;
    punchInPhoto: any;
    punchInLatitude: number;
    punchInLongitude: number;
    punchInAddress?: string | null;
    punchInGeofenceId?: string | null;
    punchInDistanceMeters?: number | null;
    remarks?: string | null;
  }) {
    return prisma.attendance.create({
      data: {
        organizationId: params.organizationId,
        employeeId: params.employeeId,
        attendanceDate: params.attendanceDate,
        shiftId: params.shiftId,
        punchInTime: params.punchInTime,
        punchInPhoto: params.punchInPhoto,
        punchInLatitude: new Prisma.Decimal(params.punchInLatitude),
        punchInLongitude: new Prisma.Decimal(params.punchInLongitude),
        punchInAddress: params.punchInAddress,
        punchInGeofenceId: params.punchInGeofenceId,
        punchInDistanceMeters: params.punchInDistanceMeters,
        remarks: params.remarks,
        status: "PRESENT",
      },
      include: {
        shift: true,
        punchInGeofence: {
          select: { id: true, name: true, code: true, address: true },
        },
      },
    });
  }

  /**
   * Update attendance with punch out details
   */
  async updatePunchOut(
    attendanceId: string,
    organizationId: string,
    params: {
      punchOutTime: Date;
      punchOutPhoto: any;
      punchOutLatitude: number;
      punchOutLongitude: number;
      punchOutAddress?: string | null;
      punchOutGeofenceId?: string | null;
      punchOutDistanceMeters?: number | null;
      remarks?: string | null;
      status?: "PRESENT" | "HALF_DAY" | "ABSENT";
    }
  ) {
    return prisma.attendance.update({
      where: {
        id: attendanceId,
        organizationId,
      },
      data: {
        punchOutTime: params.punchOutTime,
        punchOutPhoto: params.punchOutPhoto,
        punchOutLatitude: new Prisma.Decimal(params.punchOutLatitude),
        punchOutLongitude: new Prisma.Decimal(params.punchOutLongitude),
        punchOutAddress: params.punchOutAddress,
        punchOutGeofenceId: params.punchOutGeofenceId,
        punchOutDistanceMeters: params.punchOutDistanceMeters,
        ...(params.remarks && { remarks: params.remarks }),
        ...(params.status && { status: params.status }),
      },
      include: {
        shift: true,
        punchInGeofence: {
          select: { id: true, name: true, code: true, address: true },
        },
        punchOutGeofence: {
          select: { id: true, name: true, code: true, address: true },
        },
      },
    });
  }

  /**
   * Find attendance by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.attendance.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            designation: true,
            allowAttendanceFromAnywhere: true,
          },
        },
        shift: true,
        punchInGeofence: true,
        punchOutGeofence: true,
      },
    });
  }

  /**
   * List all attendance logs for organization (Admin view)
   */
  async findAll(organizationId: string, filters: GetAttendancesQueryInput) {
    const {
      page,
      limit,
      date,
      startDate,
      endDate,
      employeeId,
      departmentId,
      shiftId,
      status,
      search,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {
      organizationId,
      ...(employeeId && { employeeId }),
      ...(shiftId && { shiftId }),
      ...(status && { status }),
      ...(date && {
        attendanceDate: new Date(date),
      }),
      ...(startDate &&
        endDate && {
          attendanceDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(departmentId && {
        employee: {
          departmentAssignments: {
            some: { departmentId },
          },
        },
      }),
      ...(search && {
        employee: {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
          ],
        },
      }),
    };

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              designation: true,
            },
          },
          shift: {
            select: { id: true, name: true, code: true, startTime: true, endTime: true },
          },
          punchInGeofence: {
            select: { id: true, name: true, code: true },
          },
          punchOutGeofence: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      attendances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List personal attendance logs for employee
   */
  async findMyAttendances(
    employeeId: string,
    organizationId: string,
    filters: GetMyAttendanceQueryInput
  ) {
    const { page, limit, startDate, endDate, status } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceWhereInput = {
      employeeId,
      organizationId,
      ...(status && { status }),
      ...(startDate &&
        endDate && {
          attendanceDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { attendanceDate: "desc" },
        include: {
          shift: {
            select: { id: true, name: true, code: true, startTime: true, endTime: true },
          },
          punchInGeofence: {
            select: { id: true, name: true, code: true },
          },
          punchOutGeofence: {
            select: { id: true, name: true, code: true },
          },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      attendances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Daily analytics summary for tenant
   */
  async getDailySummary(organizationId: string, targetDate: Date) {
    const [totalEmployees, presentCount, halfDayCount, onLeaveCount] = await Promise.all([
      prisma.employee.count({
        where: {
          organizationId,
          isDeleted: false,
          employmentStatus: "ACTIVE",
        },
      }),
      prisma.attendance.count({
        where: {
          organizationId,
          attendanceDate: targetDate,
          status: "PRESENT",
        },
      }),
      prisma.attendance.count({
        where: {
          organizationId,
          attendanceDate: targetDate,
          status: "HALF_DAY",
        },
      }),
      prisma.attendance.count({
        where: {
          organizationId,
          attendanceDate: targetDate,
          status: "ON_LEAVE",
        },
      }),
    ]);

    const totalMarked = presentCount + halfDayCount + onLeaveCount;
    const unpunchedCount = Math.max(0, totalEmployees - totalMarked);

    return {
      date: targetDate.toISOString().split("T")[0],
      totalEmployees,
      presentCount,
      halfDayCount,
      onLeaveCount,
      unpunchedCount,
    };
  }

  /**
   * Admin regularization / manual override
   */
  async regularize(
    id: string,
    organizationId: string,
    data: RegularizeAttendanceInput
  ) {
    return prisma.attendance.update({
      where: {
        id,
        organizationId,
      },
      data: {
        ...(data.punchInTime !== undefined && {
          punchInTime: data.punchInTime ? new Date(data.punchInTime) : null,
        }),
        ...(data.punchOutTime !== undefined && {
          punchOutTime: data.punchOutTime ? new Date(data.punchOutTime) : null,
        }),
        ...(data.status && { status: data.status }),
        remarks: data.remarks,
      },
      include: {
        employee: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true },
        },
        shift: true,
      },
    });
  }
}

export const attendanceRepo = new AttendanceRepository();
