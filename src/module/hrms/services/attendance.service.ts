import { attendanceRepo } from "../repos/attendance.repo.js";
import { geofenceRepo } from "../repos/geofence.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { evaluateGeofences } from "../../../utils/geo.util.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  PunchInInput,
  PunchOutInput,
  GetAttendancesQueryInput,
  GetMyAttendanceQueryInput,
  RegularizeAttendanceInput,
} from "../validators/attendance.validator.js";

function getNormalizedDate(dateStr?: string): Date {
  if (dateStr) {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export class AttendanceService {
  /**
   * Helper: Resolve employee entity for current user or throw
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        userId,
        organizationId,
        isDeleted: false,
      },
      include: {
        shift: {
          where: { isDeleted: false, status: "ACTIVE" },
        },
        geofences: {
          where: { isDeleted: false, status: "ACTIVE" },
        },
      },
    });

    if (!employee) {
      throw new ErrorResponse(
        "No active employee profile linked to your user account",
        statusCode.Forbidden
      );
    }

    return employee;
  }

  /**
   * Live Facial Selfie Punch In
   */
  async punchIn(
    organizationId: string,
    userId: string,
    input: PunchInInput,
    photoFile?: Express.Multer.File
  ) {
    if (!photoFile) {
      throw new ErrorResponse(
        "Live camera facial photo is required for Punch In",
        statusCode.Bad_Request
      );
    }

    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    const today = getNormalizedDate();

    // 1. Check if already punched in for today
    const existing = await attendanceRepo.findByEmployeeAndDate(employee.id, organizationId, today);
    if (existing && existing.punchInTime) {
      throw new ErrorResponse(
        `You have already punched in today at ${existing.punchInTime.toLocaleTimeString("en-IN")}`,
        statusCode.Conflict
      );
    }

    // 2. Geofence evaluation
    let matchedGeofenceId: string | null = null;
    let distanceMeters: number | null = null;

    if (!employee.allowAttendanceFromAnywhere) {
      if (!employee.geofences || employee.geofences.length === 0) {
        throw new ErrorResponse(
          "No geofence area assigned to your profile. Please contact your HR administrator.",
          statusCode.Forbidden
        );
      }

      const matchResult = evaluateGeofences(
        input.latitude,
        input.longitude,
        employee.geofences
      );

      if (!matchResult.isWithinGeofence) {
        throw new ErrorResponse(
          `Punch in failed: You are outside your assigned geofence area. Nearest zone '${matchResult.nearestGeofenceName}' is ${matchResult.nearestGeofenceDistanceMeters}m away.`,
          statusCode.Bad_Request
        );
      }

      matchedGeofenceId = matchResult.matchedGeofenceId;
      distanceMeters = matchResult.distanceMeters;
    } else {
      // If allowed from anywhere, optionally match geofence if nearby
      const matchResult = evaluateGeofences(
        input.latitude,
        input.longitude,
        employee.geofences || []
      );
      if (matchResult.isWithinGeofence) {
        matchedGeofenceId = matchResult.matchedGeofenceId;
        distanceMeters = matchResult.distanceMeters;
      }
    }

    // 3. Upload facial photo through multi-cloud storage service
    const uploadResult = await storageService.upload(
      {
        buffer: photoFile.buffer,
        originalname: photoFile.originalname || "punch-in.jpg",
        mimetype: photoFile.mimetype || "image/jpeg",
        size: photoFile.size,
      },
      {
        folder: `homio/organizations/${organizationId}/hrms/attendance/punch-in`,
        resourceType: "image",
      }
    );

    const punchInPhoto: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes || photoFile.size,
      format: uploadResult.format || "jpg",
      provider: uploadResult.provider || "cloudinary",
    };

    // 4. Record punch in
    return attendanceRepo.createPunchIn({
      organizationId,
      employeeId: employee.id,
      attendanceDate: today,
      shiftId: employee.shiftId,
      punchInTime: new Date(),
      punchInPhoto,
      punchInLatitude: input.latitude,
      punchInLongitude: input.longitude,
      punchInAddress: input.address,
      punchInGeofenceId: matchedGeofenceId,
      punchInDistanceMeters: distanceMeters,
      remarks: input.remarks,
    });
  }

  /**
   * Live Facial Selfie Punch Out
   */
  async punchOut(
    organizationId: string,
    userId: string,
    input: PunchOutInput,
    photoFile?: Express.Multer.File
  ) {
    if (!photoFile) {
      throw new ErrorResponse(
        "Live camera facial photo is required for Punch Out",
        statusCode.Bad_Request
      );
    }

    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    const today = getNormalizedDate();

    // 1. Verify punch-in exists for today
    const existing = await attendanceRepo.findByEmployeeAndDate(employee.id, organizationId, today);
    if (!existing || !existing.punchInTime) {
      throw new ErrorResponse(
        "You cannot punch out without an active punch-in for today",
        statusCode.Bad_Request
      );
    }

    if (existing.punchOutTime) {
      throw new ErrorResponse(
        `You have already punched out today at ${existing.punchOutTime.toLocaleTimeString("en-IN")}`,
        statusCode.Conflict
      );
    }

    // 2. Geofence evaluation
    let matchedGeofenceId: string | null = null;
    let distanceMeters: number | null = null;

    if (!employee.allowAttendanceFromAnywhere) {
      if (employee.geofences && employee.geofences.length > 0) {
        const matchResult = evaluateGeofences(
          input.latitude,
          input.longitude,
          employee.geofences
        );

        if (!matchResult.isWithinGeofence) {
          throw new ErrorResponse(
            `Punch out failed: You are outside your assigned geofence area. Nearest zone '${matchResult.nearestGeofenceName}' is ${matchResult.nearestGeofenceDistanceMeters}m away.`,
            statusCode.Bad_Request
          );
        }

        matchedGeofenceId = matchResult.matchedGeofenceId;
        distanceMeters = matchResult.distanceMeters;
      }
    } else {
      const matchResult = evaluateGeofences(
        input.latitude,
        input.longitude,
        employee.geofences || []
      );
      if (matchResult.isWithinGeofence) {
        matchedGeofenceId = matchResult.matchedGeofenceId;
        distanceMeters = matchResult.distanceMeters;
      }
    }

    // 3. Upload facial photo through multi-cloud storage service
    const uploadResult = await storageService.upload(
      {
        buffer: photoFile.buffer,
        originalname: photoFile.originalname || "punch-out.jpg",
        mimetype: photoFile.mimetype || "image/jpeg",
        size: photoFile.size,
      },
      {
        folder: `homio/organizations/${organizationId}/hrms/attendance/punch-out`,
        resourceType: "image",
      }
    );

    const punchOutPhoto: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes || photoFile.size,
      format: uploadResult.format || "jpg",
      provider: uploadResult.provider || "cloudinary",
    };

    // 4. Calculate working duration and evaluate status against shift policies
    const now = new Date();
    const punchInTime = new Date(existing.punchInTime);
    const durationMinutes = Math.round((now.getTime() - punchInTime.getTime()) / (1000 * 60));

    let finalStatus: "PRESENT" | "HALF_DAY" | "ABSENT" = "PRESENT";
    if (employee.shift) {
      const halfDayThreshold = employee.shift.halfDayThresholdMinutes || 240;
      if (durationMinutes < halfDayThreshold) {
        finalStatus = "HALF_DAY";
      }
    }

    return attendanceRepo.updatePunchOut(existing.id, organizationId, {
      punchOutTime: now,
      punchOutPhoto,
      punchOutLatitude: input.latitude,
      punchOutLongitude: input.longitude,
      punchOutAddress: input.address,
      punchOutGeofenceId: matchedGeofenceId,
      punchOutDistanceMeters: distanceMeters,
      remarks: input.remarks,
      status: finalStatus,
    });
  }

  /**
   * Get punch status for current employee today
   */
  async getTodayStatus(organizationId: string, userId: string) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    const today = getNormalizedDate();

    const attendance = await attendanceRepo.findByEmployeeAndDate(employee.id, organizationId, today);

    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      displayName: employee.displayName || `${employee.firstName} ${employee.lastName || ""}`.trim(),
      allowAttendanceFromAnywhere: employee.allowAttendanceFromAnywhere,
      shift: employee.shift,
      assignedGeofences: employee.geofences,
      hasPunchedIn: !!attendance?.punchInTime,
      hasPunchedOut: !!attendance?.punchOutTime,
      attendance,
    };
  }

  /**
   * Get employee's personal attendance history
   */
  async getMyAttendanceHistory(
    organizationId: string,
    userId: string,
    filters: GetMyAttendanceQueryInput
  ) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return attendanceRepo.findMyAttendances(employee.id, organizationId, filters);
  }

  /**
   * List all attendance records (Admin / HR)
   */
  async getAllAttendances(organizationId: string, filters: GetAttendancesQueryInput) {
    return attendanceRepo.findAll(organizationId, filters);
  }

  /**
   * Get daily organization attendance summary
   */
  async getDailySummary(organizationId: string, dateStr?: string) {
    const targetDate = getNormalizedDate(dateStr);
    return attendanceRepo.getDailySummary(organizationId, targetDate);
  }

  /**
   * Get single attendance record by ID
   */
  async getAttendanceById(id: string, organizationId: string) {
    const record = await attendanceRepo.findById(id, organizationId);
    if (!record) {
      throw new ErrorResponse("Attendance record not found", statusCode.Not_Found);
    }
    return record;
  }

  /**
   * Regularize attendance (Admin manual update)
   */
  async regularizeAttendance(
    id: string,
    organizationId: string,
    data: RegularizeAttendanceInput
  ) {
    await this.getAttendanceById(id, organizationId);
    return attendanceRepo.regularize(id, organizationId, data);
  }
}

export const attendanceService = new AttendanceService();
