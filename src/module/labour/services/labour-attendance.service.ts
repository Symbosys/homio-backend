import { labourAttendanceRepo } from "../repos/labour-attendance.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  PunchInInput,
  PunchOutInput,
  CreateManualAttendanceInput,
  UpdateAttendanceInput,
  ApproveAttendanceInput,
  GetAttendancesQuery,
} from "../validators/labour-attendance.validator.js";

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
 * Handles live selfie upload, geofenced GPS verification, punch-out hour computation, and wage calculation.
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
   * 1. GEOFENCED PUNCH IN
   */
  async punchIn(
    payload: PunchInInput,
    organizationId: string,
    file?: Express.Multer.File
  ) {
    // 1. Verify Labour exists
    const labour = await labourRepo.findById(payload.labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    // 2. Fetch ProjectSite and check GPS coordinates
    const projectSite = await prisma.projectSite.findFirst({
      where: {
        id: payload.projectSiteId,
        project: { organizationId, isDeleted: false },
      },
    });
    if (!projectSite) {
      throw new ErrorResponse("Project site not found or unauthorized", statusCode.Not_Found);
    }

    // 3. Geofence Distance Calculation
    let distanceMeters = 0;
    let isWithinRadius = true;
    const allowedRadius = projectSite.punchRadiusMeters || 200;

    if (projectSite.gpsLat != null && projectSite.gpsLng != null) {
      distanceMeters = calculateGpsDistanceMeters(
        payload.punchInLat,
        payload.punchInLng,
        projectSite.gpsLat,
        projectSite.gpsLng
      );

      isWithinRadius = distanceMeters <= allowedRadius;

      if (!isWithinRadius && projectSite.isPunchGeofenceStrict) {
        throw new ErrorResponse(
          `Labour is outside the authorized project site perimeter. Distance: ${distanceMeters}m (Allowed max: ${allowedRadius}m). Punch rejected.`,
          statusCode.Forbidden
        );
      }
    }

    // 4. Date Normalization (Today / specific date)
    const today = payload.attendanceDate ? new Date(payload.attendanceDate) : new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check if attendance already exists for today
    const existing = await labourAttendanceRepo.findByUniqueDate(
      payload.projectSiteId,
      payload.labourId,
      today
    );
    if (existing && existing.punchInTime) {
      throw new ErrorResponse("Labour has already punched in for today at this site", statusCode.Conflict);
    }

    // 5. Upload live selfie photo
    let punchInPhoto: ImageType | undefined;
    if (file) {
      punchInPhoto = await this.uploadToCloud(file, "homio/labour/attendance");
    }

    // 6. Determine day wage rate (from booking or worker default)
    let dayWage = Number(labour.dailyRate);
    if (payload.bookingId) {
      const booking = await labourBookingRepo.findById(payload.bookingId, organizationId);
      if (booking) {
        dayWage = Number(booking.agreedDailyRate);
      }
    }

    const status = isWithinRadius ? "PENDING_APPROVAL" : "GEO_MISMATCH";

    const createData = {
      ...payload,
      attendanceDate: today,
      punchInTime: new Date(),
      punchInDistanceMeters: distanceMeters,
      isPunchInWithinRadius: isWithinRadius,
      punchInPhoto,
      dayWage,
      status,
    };

    return labourAttendanceRepo.create(createData);
  }

  /**
   * 2. GEOFENCED PUNCH OUT
   */
  async punchOut(
    attendanceId: string,
    payload: PunchOutInput,
    organizationId: string,
    file?: Express.Multer.File
  ) {
    const attendance = await labourAttendanceRepo.findById(attendanceId, organizationId);
    if (!attendance) {
      throw new ErrorResponse("Attendance record not found or unauthorized", statusCode.Not_Found);
    }

    if (!attendance.punchInTime) {
      throw new ErrorResponse("Cannot punch out without a valid punch-in record", statusCode.Bad_Request);
    }

    if (attendance.punchOutTime) {
      throw new ErrorResponse("Labour has already punched out for this shift", statusCode.Conflict);
    }

    const projectSite = attendance.projectSite;
    let distanceMeters = 0;
    let isWithinRadius = true;
    const allowedRadius = projectSite.punchRadiusMeters || 200;

    if (projectSite.gpsLat != null && projectSite.gpsLng != null) {
      distanceMeters = calculateGpsDistanceMeters(
        payload.punchOutLat,
        payload.punchOutLng,
        projectSite.gpsLat,
        projectSite.gpsLng
      );

      isWithinRadius = distanceMeters <= allowedRadius;

      if (!isWithinRadius && projectSite.isPunchGeofenceStrict) {
        throw new ErrorResponse(
          `Labour is outside the authorized project site perimeter for punch out. Distance: ${distanceMeters}m (Allowed max: ${allowedRadius}m). Punch rejected.`,
          statusCode.Forbidden
        );
      }
    }

    // Upload punch-out photo
    let punchOutPhoto: ImageType | undefined;
    if (file) {
      punchOutPhoto = await this.uploadToCloud(file, "homio/labour/attendance");
    }

    // Compute hours worked
    const punchOutTime = new Date();
    const punchInTime = new Date(attendance.punchInTime);
    const diffMs = punchOutTime.getTime() - punchInTime.getTime();
    const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

    // Determine status based on hours
    let status = attendance.status;
    if (status !== "GEO_MISMATCH") {
      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
      } else {
        status = "PENDING_APPROVAL";
      }
    }

    return labourAttendanceRepo.update(attendanceId, {
      punchOutTime,
      punchOutLat: payload.punchOutLat,
      punchOutLng: payload.punchOutLng,
      punchOutAddress: payload.punchOutAddress,
      punchOutDistanceMeters: distanceMeters,
      isPunchOutWithinRadius: isWithinRadius,
      punchOutPhoto,
      hoursWorked,
      status,
      workNotes: payload.workNotes ?? attendance.workNotes,
    });
  }

  /**
   * 3. MANUAL ATTENDANCE ENTRY (By supervisor / manager)
   */
  async createManualAttendance(payload: CreateManualAttendanceInput, organizationId: string) {
    const labour = await labourRepo.findById(payload.labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    const projectSite = await prisma.projectSite.findFirst({
      where: {
        id: payload.projectSiteId,
        project: { organizationId, isDeleted: false },
      },
    });
    if (!projectSite) {
      throw new ErrorResponse("Project site not found or unauthorized", statusCode.Not_Found);
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
      const booking = await labourBookingRepo.findById(payload.bookingId, organizationId);
      if (booking) {
        dayWage = Number(booking.agreedDailyRate);
      }
    }

    return labourAttendanceRepo.create({
      ...payload,
      attendanceDate,
      dayWage,
    });
  }

  /**
   * 4. GET ATTENDANCE BY ID
   */
  async getAttendanceById(id: string, organizationId: string) {
    const attendance = await labourAttendanceRepo.findById(id, organizationId);
    if (!attendance) {
      throw new ErrorResponse("Attendance record not found or unauthorized", statusCode.Not_Found);
    }
    return attendance;
  }

  /**
   * 5. GET ALL ATTENDANCES
   */
  async getAttendances(query: GetAttendancesQuery, organizationId: string) {
    return labourAttendanceRepo.findAll(query, organizationId);
  }

  /**
   * 6. FULL SYMMETRIC UPDATE OF ATTENDANCE (Rule 19)
   */
  async updateAttendance(id: string, payload: UpdateAttendanceInput, organizationId: string) {
    await this.getAttendanceById(id, organizationId);
    return labourAttendanceRepo.update(id, payload);
  }

  /**
   * 7. SUPERVISOR APPROVE ATTENDANCE
   */
  async approveAttendance(id: string, payload: ApproveAttendanceInput, organizationId: string) {
    await this.getAttendanceById(id, organizationId);
    return labourAttendanceRepo.update(id, {
      supervisorApproved: payload.supervisorApproved,
      status: payload.status,
      supervisorNotes: payload.supervisorNotes,
      ...(payload.dayWage !== undefined && { dayWage: payload.dayWage }),
    });
  }

  /**
   * 8. DELETE ATTENDANCE
   */
  async deleteAttendance(id: string, organizationId: string) {
    const existing = await this.getAttendanceById(id, organizationId);
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
