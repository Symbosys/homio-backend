import { describe, it, expect } from "bun:test";
import {
  punchInSchema,
  punchOutSchema,
  createManualAttendanceSchema,
  updateAttendanceSchema,
  approveAttendanceSchema,
  getAttendancesQuerySchema,
} from "../../src/module/labour/validators/labour-attendance.validator.js";
import { calculateGpsDistanceMeters } from "../../src/module/labour/services/labour-attendance.service.js";
import {
  MOCK_LABOUR_ID_1,
  MOCK_PROJECT_SITE_ID_1,
  MOCK_BOOKING_ID_1,
  MOCK_ATTENDANCE_ID_1,
  MOCK_SITE_GPS,
  MOCK_PUNCH_INSIDE_GPS,
  MOCK_PUNCH_OUTSIDE_GPS,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Geofenced Attendance & Punch Tests", () => {
  // =========================================================================
  // 1. Haversine GPS Geofence Mathematical Algorithm Unit Tests
  // =========================================================================
  describe("1. Haversine GPS Distance Calculation", () => {
    it("should return 0 meters for identical coordinates", () => {
      const distance = calculateGpsDistanceMeters(
        MOCK_SITE_GPS.lat,
        MOCK_SITE_GPS.lng,
        MOCK_SITE_GPS.lat,
        MOCK_SITE_GPS.lng
      );
      expect(distance).toBe(0);
    });

    it("should verify that punch location inside perimeter is within 200m radius", () => {
      const distance = calculateGpsDistanceMeters(
        MOCK_PUNCH_INSIDE_GPS.lat,
        MOCK_PUNCH_INSIDE_GPS.lng,
        MOCK_SITE_GPS.lat,
        MOCK_SITE_GPS.lng
      );
      // Distance is approximately 25-35 meters
      expect(distance).toBeLessThanOrEqual(MOCK_SITE_GPS.punchRadiusMeters);
      expect(distance).toBeGreaterThan(0);
    });

    it("should verify that outside punch location exceeds 200m perimeter", () => {
      const distance = calculateGpsDistanceMeters(
        MOCK_PUNCH_OUTSIDE_GPS.lat,
        MOCK_PUNCH_OUTSIDE_GPS.lng,
        MOCK_SITE_GPS.lat,
        MOCK_SITE_GPS.lng
      );
      // Distance is ~5 km
      expect(distance).toBeGreaterThan(MOCK_SITE_GPS.punchRadiusMeters);
      expect(distance).toBeGreaterThan(4000);
    });
  });

  // =========================================================================
  // 2. Punch In Payload Validation
  // =========================================================================
  describe("2. Punch In Schema Validation", () => {
    it("should validate punch-in payload with GPS coordinates and site details", () => {
      const payload = {
        body: {
          labourId: MOCK_LABOUR_ID_1,
          projectSiteId: MOCK_PROJECT_SITE_ID_1,
          bookingId: MOCK_BOOKING_ID_1,
          punchInLat: MOCK_PUNCH_INSIDE_GPS.lat,
          punchInLng: MOCK_PUNCH_INSIDE_GPS.lng,
          punchInAddress: "Prestige Lakeside, Bangalore",
          workNotes: "Arrived on time for ceiling framing work.",
          additionalInformation: {
            appVersion: "1.4.2",
            batteryLevel: "88%",
          },
        },
      };

      const parsed = punchInSchema.parse(payload);
      expect(parsed.body.labourId).toBe(MOCK_LABOUR_ID_1);
      expect(parsed.body.punchInLat).toBe(MOCK_PUNCH_INSIDE_GPS.lat);
      expect(parsed.body.additionalInformation?.batteryLevel).toBe("88%");
    });

    it("should reject punch-in without GPS coordinates", () => {
      expect(() =>
        punchInSchema.parse({
          body: {
            labourId: MOCK_LABOUR_ID_1,
            projectSiteId: MOCK_PROJECT_SITE_ID_1,
          },
        })
      ).toThrow();
    });
  });

  // =========================================================================
  // 3. Punch Out & Hours Worked Computation Tests
  // =========================================================================
  describe("3. Punch Out & Working Hours Calculation", () => {
    it("should correctly compute 8.5 hours between punchIn (09:00) and punchOut (17:30)", () => {
      const punchInTime = new Date("2026-10-01T09:00:00.000Z");
      const punchOutTime = new Date("2026-10-01T17:30:00.000Z");

      const diffMs = punchOutTime.getTime() - punchInTime.getTime();
      const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      expect(hoursWorked).toBe(8.5);

      // Status classification test
      let status = "PENDING_APPROVAL";
      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
      }

      expect(status).toBe("PRESENT");
    });

    it("should correctly classify 4.5 hours as HALF_DAY", () => {
      const punchInTime = new Date("2026-10-01T09:00:00.000Z");
      const punchOutTime = new Date("2026-10-01T13:30:00.000Z");

      const diffMs = punchOutTime.getTime() - punchInTime.getTime();
      const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      expect(hoursWorked).toBe(4.5);

      let status = "PENDING_APPROVAL";
      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
      }

      expect(status).toBe("HALF_DAY");
    });

    it("should correctly classify 10.5 hours as OVERTIME", () => {
      const punchInTime = new Date("2026-10-01T08:00:00.000Z");
      const punchOutTime = new Date("2026-10-01T18:30:00.000Z");

      const diffMs = punchOutTime.getTime() - punchInTime.getTime();
      const hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      expect(hoursWorked).toBe(10.5);

      let status = "PENDING_APPROVAL";
      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
      }

      expect(status).toBe("OVERTIME");
    });

    it("should validate punch-out payload with GPS", () => {
      const parsed = punchOutSchema.parse({
        params: { id: MOCK_ATTENDANCE_ID_1 },
        body: {
          punchOutLat: MOCK_PUNCH_INSIDE_GPS.lat,
          punchOutLng: MOCK_PUNCH_INSIDE_GPS.lng,
          workNotes: "Completed panel framing and tidied workspace.",
        },
      });

      expect(parsed.params.id).toBe(MOCK_ATTENDANCE_ID_1);
      expect(parsed.body.punchOutLat).toBe(MOCK_PUNCH_INSIDE_GPS.lat);
    });
  });

  // =========================================================================
  // 4. Manual Entry & Supervisor Approval Validation
  // =========================================================================
  describe("4. Manual Entry & Approval", () => {
    it("should validate manual attendance logging by supervisor", () => {
      const manualPayload = {
        body: {
          labourId: MOCK_LABOUR_ID_1,
          projectSiteId: MOCK_PROJECT_SITE_ID_1,
          attendanceDate: "2026-10-01",
          status: "PRESENT" as const,
          hoursWorked: 8.0,
          dayWage: 1200.0,
          supervisorApproved: true,
          supervisorNotes: "Manual site punch added due to worker low battery.",
        },
      };

      const parsed = createManualAttendanceSchema.parse(manualPayload);
      expect(parsed.body.hoursWorked).toBe(8.0);
      expect(parsed.body.dayWage).toBe(1200.0);
      expect(parsed.body.supervisorApproved).toBe(true);
    });

    it("should validate supervisor sign-off and approval payload", () => {
      const approvePayload = {
        params: { id: MOCK_ATTENDANCE_ID_1 },
        body: {
          supervisorApproved: true,
          status: "PRESENT" as const,
          supervisorNotes: "Checked physical presence on 4th floor.",
          dayWage: 1200.0,
        },
      };

      const parsed = approveAttendanceSchema.parse(approvePayload);
      expect(parsed.body.supervisorApproved).toBe(true);
      expect(parsed.body.status).toBe("PRESENT");
    });
  });

  // =========================================================================
  // 5. Query Filtering Validation
  // =========================================================================
  describe("5. Attendance Query Filters", () => {
    it("should parse boolean strings in supervisorApproved query parameter", () => {
      const query = {
        query: {
          projectSiteId: MOCK_PROJECT_SITE_ID_1,
          status: "PRESENT",
          supervisorApproved: "true",
        },
      };

      const parsed = getAttendancesQuerySchema.parse(query);
      expect(parsed.query.supervisorApproved).toBe(true);
      expect(parsed.query.status).toBe("PRESENT");
    });
  });
});
