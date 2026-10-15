import { labourAttendanceRepo } from "../repos/labour-attendance.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, LabourStatus } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  PunchInInput,
  PunchOutInput,
  CreateManualAttendanceInput,
  UpdateAttendanceInput,
  ApproveAttendanceInput,
  GetAttendancesQuery,
} from "../validators/labour-attendance.validator.js";

export interface AttendanceActor {
  id: string;
  userType: "PLATFORM_ADMIN" | "ADMIN" | "USER" | "LABOUR";
  organizationId?: string | null;
}

/**
 * Calculates straight-line distance in meters between two GPS coordinates using Haversine formula
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Labour Attendance Service
 * Handles live selfie upload, geofenced GPS verification against service bookings, punch-out hour computation, and wage calculation.
 */
export class LabourAttendanceService {
  /**
   * Safely deletes an old cloud asset
   */
  private async pruneOldCloudAsset(oldDoc: unknown) {
    if (oldDoc && typeof oldDoc === "object" && "id" in (oldDoc as any)) {
      const publicId = (oldDoc as { id?: string }).id;
      if (publicId && typeof publicId === "string") {
        try {
          await storageService.delete(publicId);
        } catch (error) {
          console.error(`[LabourAttendanceService] Failed to prune cloud photo ${publicId}:`, error);
        }
      }
    }
  }

  /**
   * Upload file to cloud storage
   */
  private async uploadToCloud(file: Express.Multer.File, folder: string): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder }
    );

    return {
      id: uploadResult.publicId,
      url: uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };
  }

  /**
   * Fetch today's attendance status, active service booking, and geofence perimeter
   * Worker can ONLY mark attendance if they are booked for an active service.
   */
  async getTodayStatus(actor: AttendanceActor, labourId?: string) {
    let labour = null;

    if (labourId) {
      labour = await prisma.labour.findFirst({
        where: {
          id: labourId,
          ...(actor.organizationId ? { organizationId: actor.organizationId } : {}),
          isDeleted: false,
        },
        include: {
          kycDocument: true,
          user: {
            select: { id: true, email: true, status: true, userType: true },
          },
        },
      });
    } else {
      labour = await prisma.labour.findFirst({
        where: { userId: actor.id, isDeleted: false },
        include: {
          kycDocument: true,
          user: {
            select: { id: true, email: true, status: true, userType: true },
          },
        },
      });
    }

    if (!labour) {
      return {
        hasActiveBooking: false,
        labour: null,
        activeBooking: null,
        activeBookings: [],
        attendance: null,
        status: "NOT_PUNCHED_IN",
        message: "Labour worker profile not found.",
      };
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);

    // 1. Check if there is an active open shift right now
    const activeOpenShift = await labourAttendanceRepo.findActivePunchedIn(labour.id);

    // 2. Query active service bookings covering today
    const activeBookings = await prisma.labourBooking.findMany({
      where: {
        labourId: labour.id,
        isDeleted: false,
        startDate: { lte: endOfToday },
        endDate: { gte: startOfToday },
        status: { in: ["CONFIRMED", "ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"] },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: {
              select: {
                id: true,
                siteName: true,
                address: true,
                city: true,
                state: true,
                gpsLat: true,
                gpsLng: true,
                punchRadiusMeters: true,
                isPunchGeofenceStrict: true,
              },
            },
          },
        },
        projectService: {
          select: {
            id: true,
            title: true,
            serviceCode: true,
            category: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // If currently punched in
    if (activeOpenShift) {
      return {
        hasActiveBooking: true,
        labour,
        activeBooking: activeOpenShift.booking || activeBookings[0] || null,
        activeBookings,
        attendance: activeOpenShift,
        status: "PUNCHED_IN" as const,
      };
    }

    // If no active booking scheduled for today and not punched in
    if (activeBookings.length === 0) {
      return {
        hasActiveBooking: false,
        labour,
        activeBooking: null,
        activeBookings: [],
        attendance: null,
        status: "NOT_PUNCHED_IN" as const,
        message: "No active service booking found for today. You can only mark attendance when you are booked for an active service.",
      };
    }

    // Worker has active booking(s) scheduled for today. Check if today's attendance has been marked.
    const primaryBooking = activeBookings[0];
    if (!primaryBooking) {
      return {
        hasActiveBooking: false,
        labour,
        activeBooking: null,
        activeBookings: [],
        attendance: null,
        status: "NOT_PUNCHED_IN" as const,
        message: "No active service booking found for today. You can only mark attendance when you are booked for an active service.",
      };
    }

    const todayAttendance = await labourAttendanceRepo.findTodayAttendanceByBooking(
      labour.id,
      primaryBooking.id,
      startOfToday
    );

    let status: "NOT_PUNCHED_IN" | "PUNCHED_IN" | "COMPLETED" = "NOT_PUNCHED_IN";
    if (todayAttendance?.punchOutTime) {
      status = "COMPLETED";
    } else if (todayAttendance?.punchInTime) {
      status = "PUNCHED_IN";
    }

    return {
      hasActiveBooking: true,
      labour,
      activeBooking: primaryBooking,
      activeBookings,
      attendance: todayAttendance,
      status,
    };
  }

  /**
   * 1. GEOFENCED PUNCH IN
   * Strictly enforces that worker is booked for an active service.
   */
  async punchIn(
    payload: PunchInInput,
    actor: AttendanceActor,
    file?: Express.Multer.File
  ) {
    // 1. Resolve Labour profile
    let labour = null;
    if (actor.userType === "LABOUR") {
      labour = await prisma.labour.findFirst({
        where: { userId: actor.id, isDeleted: false },
      });
      if (!labour) {
        throw new ErrorResponse("Labour worker profile not found", statusCode.Not_Found);
      }
    } else {
      if (payload.labourId) {
        labour = await prisma.labour.findFirst({
          where: {
            id: payload.labourId,
            ...(actor.organizationId ? { organizationId: actor.organizationId } : {}),
            isDeleted: false,
          },
        });
      } else {
        labour = await prisma.labour.findFirst({
          where: { userId: actor.id, isDeleted: false },
        });
      }
      if (!labour) {
        throw new ErrorResponse("Labour worker not found", statusCode.Not_Found);
      }
    }

    // 2. Mandatory Active Booking Validation
    if (!payload.bookingId) {
      throw new ErrorResponse(
        "Booking ID is required. Attendance can ONLY be marked for an active service booking.",
        statusCode.Bad_Request
      );
    }

    const booking = await prisma.labourBooking.findFirst({
      where: { id: payload.bookingId, isDeleted: false },
      include: {
        project: { include: { site: true } },
        projectService: true,
        labour: true,
      },
    });

    if (!booking) {
      throw new ErrorResponse(
        "Service booking not found. Attendance can ONLY be marked for a valid service booking.",
        statusCode.Not_Found
      );
    }

    // 3. Verify Labour Worker Assignment
    if (booking.labourId !== labour.id) {
      throw new ErrorResponse(
        "Labour worker is not assigned to this service booking. Attendance rejected.",
        statusCode.Forbidden
      );
    }

    // 4. Verify Booking Lifecycle Status
    const ALLOWED_STATUSES = ["CONFIRMED", "ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"];
    if (!ALLOWED_STATUSES.includes(booking.status)) {
      throw new ErrorResponse(
        `Cannot mark attendance: Booking is in '${booking.status}' status. Attendance is only permitted for confirmed, accepted, or in-progress bookings.`,
        statusCode.Forbidden
      );
    }

    // Direct client / marketplace bookings require quotation to be sent and accepted before work can start
    const isClientBooking = booking.channel === "PLATFORM_MARKETPLACE" || Boolean(booking.clientId);
    if (isClientBooking && (!booking.dealAcceptedAt || (!booking.quoteSubmittedAt && !booking.quoteAmount))) {
      throw new ErrorResponse(
        "Work cannot be started until quotation has been sent and accepted by the client.",
        statusCode.Bad_Request
      );
    }

    // 5. Verify Booking Date Window
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setUTCHours(23, 59, 59, 999);

    const bookingStart = new Date(booking.startDate);
    bookingStart.setUTCHours(0, 0, 0, 0);
    const bookingEnd = new Date(booking.endDate);
    bookingEnd.setUTCHours(23, 59, 59, 999);

    if (endOfToday < bookingStart || startOfToday > bookingEnd) {
      throw new ErrorResponse(
        `Cannot mark attendance: Today is outside the scheduled service booking period (${bookingStart.toISOString().slice(0, 10)} to ${bookingEnd.toISOString().slice(0, 10)}).`,
        statusCode.Forbidden
      );
    }

    // 6. Check Active Shift (Cannot punch in if already punched in without punch out)
    const activeOpenShift = await labourAttendanceRepo.findActivePunchedIn(labour.id);
    if (activeOpenShift) {
      throw new ErrorResponse(
        "Labour already has an open punch-in shift. You must punch out before starting a new shift.",
        statusCode.Conflict
      );
    }

    // 7. Check Duplicate Today Shift for this Booking
    const alreadyCompletedToday = await labourAttendanceRepo.findTodayAttendanceByBooking(
      labour.id,
      booking.id,
      startOfToday
    );
    if (alreadyCompletedToday && alreadyCompletedToday.punchOutTime) {
      throw new ErrorResponse(
        "Attendance for this service booking has already been completed for today.",
        statusCode.Conflict
      );
    }

    // 8. Service Location & Geofence Validation
    const targetLat =
      booking.latitude != null
        ? Number(booking.latitude)
        : booking.project?.site?.gpsLat != null
          ? Number(booking.project.site.gpsLat)
          : null;

    const targetLng =
      booking.longitude != null
        ? Number(booking.longitude)
        : booking.project?.site?.gpsLng != null
          ? Number(booking.project.site.gpsLng)
          : null;

    const allowedRadius = booking.geofenceRadius || booking.project?.site?.punchRadiusMeters || 200;
    const isStrictGeofence = booking.isStrictGeofence ?? booking.project?.site?.isPunchGeofenceStrict ?? true;

    let distanceMeters: number | null = null;
    let isWithinRadius = true;

    if (targetLat != null && targetLng != null) {
      distanceMeters = calculateGpsDistanceMeters(
        payload.punchInLat,
        payload.punchInLng,
        targetLat,
        targetLng
      );
      isWithinRadius = distanceMeters <= allowedRadius;

      if (!isWithinRadius && isStrictGeofence) {
        throw new ErrorResponse(
          `Punch-in rejected: Outside authorized service site perimeter. Distance: ${distanceMeters}m (Max allowed: ${allowedRadius}m).`,
          statusCode.Forbidden
        );
      }
    }

    // 9. Upload Live Selfie Photo (Compressed < 100 KB on client)
    let punchInPhoto: ImageType | undefined;
    if (file) {
      punchInPhoto = await this.uploadToCloud(file, "homio/labour/attendance");
    }

    // 10. Financial Wage & Project Site Linkage
    const dayWage = Number(booking.agreedDailyRate) || Number(labour.dailyRate) || 0;
    const projectSiteId = booking.project?.site?.id || payload.projectSiteId || null;
    const status = isWithinRadius ? "PENDING_APPROVAL" : "GEO_MISMATCH";

    const attendance = await labourAttendanceRepo.create({
      labourId: labour.id,
      bookingId: booking.id,
      projectSiteId,
      attendanceDate: startOfToday,
      punchInTime: now,
      punchInLatitude: payload.punchInLat,
      punchInLongitude: payload.punchInLng,
      punchInAddress: payload.punchInAddress,
      punchInDistanceMeters: distanceMeters,
      punchInPhoto,
      rateApplied: dayWage,
      wageEarned: 0,
      status,
      workNotes: payload.workNotes,
      additionalInformation: payload.additionalInformation,
    });

    // 11. Auto-transition booking to WORK_STARTED if currently CONFIRMED or ACCEPTED_BY_LABOUR
    if (["CONFIRMED", "ACCEPTED_BY_LABOUR"].includes(booking.status)) {
      await prisma.labourBooking.update({
        where: { id: booking.id },
        data: {
          status: "WORK_STARTED",
          startedAt: now,
        },
      });
    }

    // Mark labour status as AT_WORK while on active shift
    await prisma.labour.update({
      where: { id: labour.id },
      data: {
        status: LabourStatus.AT_WORK,
        isAvailable: false,
      },
    });

    return attendance;
  }

  /**
   * 2. GEOFENCED PUNCH OUT
   */
  async punchOut(
    attendanceId: string,
    payload: PunchOutInput,
    actor: AttendanceActor,
    file?: Express.Multer.File
  ) {
    const attendance = await prisma.labourAttendance.findUnique({
      where: { id: attendanceId },
      include: {
        booking: {
          include: {
            project: { include: { site: true } },
          },
        },
        projectSite: true,
        labour: true,
      },
    });

    if (!attendance) {
      throw new ErrorResponse("Attendance record not found", statusCode.Not_Found);
    }

    // Worker authorization check
    if (actor.userType === "LABOUR") {
      if (attendance.labour.userId !== actor.id) {
        throw new ErrorResponse("Unauthorized: Attendance does not belong to your worker profile.", statusCode.Forbidden);
      }
    } else if (actor.organizationId) {
      const orgMatch =
        attendance.booking?.organizationId === actor.organizationId ||
        attendance.labour.organizationId === actor.organizationId;
      if (!orgMatch && actor.userType !== "PLATFORM_ADMIN") {
        throw new ErrorResponse("Unauthorized: Attendance does not belong to your organization.", statusCode.Forbidden);
      }
    }

    if (!attendance.punchInTime) {
      throw new ErrorResponse("Cannot punch out without a valid punch-in record", statusCode.Bad_Request);
    }

    if (attendance.punchOutTime) {
      throw new ErrorResponse("Labour has already punched out for this shift", statusCode.Conflict);
    }

    // Geofence check on punch out
    const booking = attendance.booking;
    const projectSite = attendance.projectSite || booking?.project?.site;

    const targetLat =
      booking?.latitude != null
        ? Number(booking.latitude)
        : projectSite?.gpsLat != null
          ? Number(projectSite.gpsLat)
          : null;

    const targetLng =
      booking?.longitude != null
        ? Number(booking.longitude)
        : projectSite?.gpsLng != null
          ? Number(projectSite.gpsLng)
          : null;

    const allowedRadius = booking?.geofenceRadius || projectSite?.punchRadiusMeters || 200;
    const isStrictGeofence = booking?.isStrictGeofence ?? projectSite?.isPunchGeofenceStrict ?? true;

    let distanceMeters: number | null = null;
    let isWithinRadius = true;

    if (targetLat != null && targetLng != null) {
      distanceMeters = calculateGpsDistanceMeters(
        payload.punchOutLat,
        payload.punchOutLng,
        targetLat,
        targetLng
      );
      isWithinRadius = distanceMeters <= allowedRadius;

      if (!isWithinRadius && isStrictGeofence) {
        throw new ErrorResponse(
          `Punch-out rejected: Outside authorized service site perimeter. Distance: ${distanceMeters}m (Max allowed: ${allowedRadius}m).`,
          statusCode.Forbidden
        );
      }
    }

    // Upload punch-out photo
    let punchOutPhoto: ImageType | undefined;
    if (file) {
      punchOutPhoto = await this.uploadToCloud(file, "homio/labour/attendance");
    }

    // Compute hours worked and wage
    const punchOutTime = new Date();
    const punchInTime = new Date(attendance.punchInTime);
    const diffMs = punchOutTime.getTime() - punchInTime.getTime();
    const hoursWorked = Math.max(0, Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100);

    const dailyRate = Number(attendance.rateApplied) || Number(attendance.booking?.agreedDailyRate) || 0;
    let wageEarned = 0;
    let status = attendance.status;

    if (status !== "GEO_MISMATCH") {
      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
        wageEarned = dailyRate;
        if (hoursWorked > 9.5) {
          const otHours = hoursWorked - 8;
          const hourlyRate = dailyRate / 8;
          wageEarned = Math.round((dailyRate + otHours * hourlyRate * 1.5) * 100) / 100;
        }
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
        wageEarned = Math.round((dailyRate / 2) * 100) / 100;
      } else {
        status = "PENDING_APPROVAL";
        const hourlyRate = dailyRate / 8;
        wageEarned = Math.round(hoursWorked * hourlyRate * 100) / 100;
      }
    }

    return labourAttendanceRepo.update(attendanceId, {
      punchOutTime,
      punchOutLatitude: payload.punchOutLat,
      punchOutLongitude: payload.punchOutLng,
      punchOutAddress: payload.punchOutAddress,
      punchOutDistanceMeters: distanceMeters,
      punchOutPhoto,
      hoursWorked,
      wageEarned,
      status,
      workNotes: payload.workNotes ?? (attendance as any).workNotes,
    });
  }

  /**
   * 3. MANUAL ATTENDANCE ENTRY (By supervisor / manager)
   */
  async createManualAttendance(payload: CreateManualAttendanceInput, actor: AttendanceActor) {
    const labour = await labourRepo.findById(payload.labourId, actor.organizationId || undefined);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    const attendanceDate = new Date(payload.attendanceDate);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    const existing = await labourAttendanceRepo.findByUniqueDate(
      payload.projectSiteId,
      payload.labourId,
      attendanceDate
    );
    if (existing) {
      throw new ErrorResponse("Attendance record already exists for this date and site", statusCode.Conflict);
    }

    let dayWage = payload.dayWage ?? Number(labour.dailyRate);
    if (!payload.dayWage && payload.bookingId) {
      const booking = await labourBookingRepo.findById(payload.bookingId, actor.organizationId || undefined);
      if (booking) {
        dayWage = Number(booking.agreedDailyRate);
      }
    }

    return labourAttendanceRepo.create({
      ...payload,
      attendanceDate,
      rateApplied: dayWage,
    });
  }

  /**
   * 4. GET ATTENDANCE BY ID
   */
  async getAttendanceById(id: string, actor: AttendanceActor) {
    const scope =
      actor.userType === "LABOUR"
        ? { workerUserId: actor.id }
        : actor.userType === "PLATFORM_ADMIN"
          ? { isPlatformAdmin: true }
          : { organizationId: actor.organizationId };

    const attendance = await labourAttendanceRepo.findById(id, scope);
    if (!attendance) {
      throw new ErrorResponse("Attendance record not found or unauthorized", statusCode.Not_Found);
    }
    return attendance;
  }

  /**
   * 5. GET ALL ATTENDANCES
   */
  async getAttendances(query: GetAttendancesQuery, actor: AttendanceActor) {
    const scope =
      actor.userType === "LABOUR"
        ? { workerUserId: actor.id }
        : actor.userType === "PLATFORM_ADMIN"
          ? { isPlatformAdmin: true }
          : actor.organizationId
            ? { organizationId: actor.organizationId }
            : { clientId: actor.id };

    return labourAttendanceRepo.findAll(query, scope);
  }

  /**
   * 6. FULL SYMMETRIC UPDATE OF ATTENDANCE (Rule 19)
   */
  async updateAttendance(id: string, payload: UpdateAttendanceInput, actor: AttendanceActor) {
    await this.getAttendanceById(id, actor);
    return labourAttendanceRepo.update(id, payload);
  }

  /**
   * 7. SUPERVISOR APPROVE ATTENDANCE
   */
  async approveAttendance(id: string, payload: ApproveAttendanceInput, actor: AttendanceActor) {
    await this.getAttendanceById(id, actor);
    return labourAttendanceRepo.update(id, {
      supervisorApproved: payload.supervisorApproved,
      status: payload.status,
      supervisorNotes: payload.supervisorNotes,
      supervisorApprovedAt: new Date(),
      supervisorApprovedBy: actor.id,
      ...(payload.dayWage !== undefined && { wageEarned: payload.dayWage }),
    });
  }

  /**
   * 8. DELETE ATTENDANCE
   */
  async deleteAttendance(id: string, actor: AttendanceActor) {
    const existing = await this.getAttendanceById(id, actor);
    if (existing.punchInPhoto) {
      await this.pruneOldCloudAsset(existing.punchInPhoto);
    }
    if (existing.punchOutPhoto) {
      await this.pruneOldCloudAsset(existing.punchOutPhoto);
    }
    return labourAttendanceRepo.delete(id);
  }
}

export const labourAttendanceService = new LabourAttendanceService();
