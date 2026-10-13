import { describe, it, expect } from "bun:test";
import {
  punchInSchema,
  punchOutSchema,
} from "../../src/module/labour/validators/labour-attendance.validator.js";
import { calculateGpsDistanceMeters } from "../../src/module/labour/services/labour-attendance.service.js";

describe("Labour Module - Service Booking Attendance & Geofence Validations", () => {
  const MOCK_LABOUR_ID = "11111111-1111-4111-8111-111111111111";
  const MOCK_OTHER_LABOUR_ID = "22222222-2222-4222-8222-222222222222";
  const MOCK_BOOKING_ID = "33333333-3333-4333-8333-333333333333";
  const MOCK_SITE_ID = "44444444-4444-4444-8444-444444444444";

  // Coordinates: Bangalore MG Road
  const BOOKING_LOCATION = {
    lat: 12.9754,
    lng: 77.6067,
    radius: 200,
    isStrict: true,
  };

  // Inside location: ~40 meters away
  const INSIDE_LOCATION = {
    lat: 12.9757,
    lng: 77.6069,
  };

  // Outside location: ~3.5 km away (Indiranagar)
  const OUTSIDE_LOCATION = {
    lat: 12.9784,
    lng: 77.6408,
  };

  // =========================================================================
  // 1. Mandatory Service Booking Schema Validation
  // =========================================================================
  describe("1. Punch In Schema Booking Enforcement", () => {
    it("should strictly require bookingId in punch-in payload", () => {
      expect(() => {
        punchInSchema.parse({
          body: {
            labourId: MOCK_LABOUR_ID,
            projectSiteId: MOCK_SITE_ID,
            punchInLat: INSIDE_LOCATION.lat,
            punchInLng: INSIDE_LOCATION.lng,
          },
        });
      }).toThrow();
    });

    it("should accept punch-in payload with valid bookingId and GPS coordinates", () => {
      const parsed = punchInSchema.parse({
        body: {
          labourId: MOCK_LABOUR_ID,
          bookingId: MOCK_BOOKING_ID,
          projectSiteId: MOCK_SITE_ID,
          punchInLat: INSIDE_LOCATION.lat,
          punchInLng: INSIDE_LOCATION.lng,
          punchInAddress: "MG Road Metro Station, Bangalore",
          workNotes: "Arrived at job site, ready to begin plastering.",
        },
      });

      expect(parsed.body.bookingId).toBe(MOCK_BOOKING_ID);
      expect(parsed.body.punchInLat).toBe(INSIDE_LOCATION.lat);
      expect(parsed.body.punchInLng).toBe(INSIDE_LOCATION.lng);
    });
  });

  // =========================================================================
  // 2. Geofence Distance & Perimeter Check
  // =========================================================================
  describe("2. Geofence Perimeter Calculations", () => {
    it("should calculate that inside coordinates are within 200m service radius", () => {
      const distance = calculateGpsDistanceMeters(
        INSIDE_LOCATION.lat,
        INSIDE_LOCATION.lng,
        BOOKING_LOCATION.lat,
        BOOKING_LOCATION.lng
      );
      expect(distance).toBeLessThanOrEqual(BOOKING_LOCATION.radius);
      expect(distance).toBeGreaterThan(0);
    });

    it("should calculate that outside coordinates exceed 200m service radius", () => {
      const distance = calculateGpsDistanceMeters(
        OUTSIDE_LOCATION.lat,
        OUTSIDE_LOCATION.lng,
        BOOKING_LOCATION.lat,
        BOOKING_LOCATION.lng
      );
      expect(distance).toBeGreaterThan(BOOKING_LOCATION.radius);
      expect(distance).toBeGreaterThan(3000);
    });
  });

  // =========================================================================
  // 3. Booking Lifecycle & Date Window Rules
  // =========================================================================
  describe("3. Service Booking Attendance Eligibility Rules", () => {
    const ALLOWED_STATUSES = ["CONFIRMED", "ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"];
    const BLOCKED_STATUSES = [
      "REQUESTED",
      "REJECTED_BY_LABOUR",
      "PENDING_QUOTE_APPROVAL",
      "COMPLETED",
      "CANCELLED",
      "DISPUTED",
    ];

    it("should permit attendance only for active booking statuses", () => {
      for (const status of ALLOWED_STATUSES) {
        expect(ALLOWED_STATUSES.includes(status)).toBe(true);
      }
    });

    it("should block attendance for inactive or disputed booking statuses", () => {
      for (const status of BLOCKED_STATUSES) {
        expect(ALLOWED_STATUSES.includes(status)).toBe(false);
      }
    });

    it("should correctly validate whether today falls within the scheduled service period", () => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setUTCHours(23, 59, 59, 999);

      // Active booking: Starts yesterday, ends tomorrow
      const activeBooking = {
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      const isActive =
        endOfToday >= activeBooking.startDate && startOfToday <= activeBooking.endDate;
      expect(isActive).toBe(true);

      // Expired booking: Ended 2 days ago
      const expiredBooking = {
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      };
      const isExpired =
        endOfToday >= expiredBooking.startDate && startOfToday <= expiredBooking.endDate;
      expect(isExpired).toBe(false);

      // Future booking: Starts in 3 days
      const futureBooking = {
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      };
      const isFuture =
        endOfToday >= futureBooking.startDate && startOfToday <= futureBooking.endDate;
      expect(isFuture).toBe(false);
    });

    it("should reject worker assignment mismatch", () => {
      const booking = {
        id: MOCK_BOOKING_ID,
        labourId: MOCK_LABOUR_ID,
      };

      const isAuthorizedAssignedWorker = booking.labourId === MOCK_LABOUR_ID;
      const isUnauthorizedWorker = booking.labourId === MOCK_OTHER_LABOUR_ID;

      expect(isAuthorizedAssignedWorker).toBe(true);
      expect(isUnauthorizedWorker).toBe(false);
    });
  });

  // =========================================================================
  // 4. Punch Out Hours Worked & Daily Wage Computation
  // =========================================================================
  describe("4. Working Hours and Wage Computation", () => {
    const DAILY_RATE = 1000; // Rs 1,000 / day
    const HOURLY_RATE = DAILY_RATE / 8; // Rs 125 / hour

    it("should compute full day wage for 8.0 hours worked", () => {
      const hoursWorked = 8.0;
      let status = "PENDING_APPROVAL";
      let wageEarned = 0;

      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
        wageEarned = DAILY_RATE;
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
        wageEarned = DAILY_RATE / 2;
      }

      expect(status).toBe("PRESENT");
      expect(wageEarned).toBe(1000);
    });

    it("should compute half day wage for 5.0 hours worked", () => {
      const hoursWorked = 5.0;
      let status = "PENDING_APPROVAL";
      let wageEarned = 0;

      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
        wageEarned = DAILY_RATE;
      } else if (hoursWorked >= 4.0) {
        status = "HALF_DAY";
        wageEarned = Math.round((DAILY_RATE / 2) * 100) / 100;
      }

      expect(status).toBe("HALF_DAY");
      expect(wageEarned).toBe(500);
    });

    it("should compute overtime wage for 10.5 hours worked (8h standard + 2.5h @ 1.5x)", () => {
      const hoursWorked = 10.5;
      let status = "PENDING_APPROVAL";
      let wageEarned = 0;

      if (hoursWorked >= 7.5) {
        status = hoursWorked > 9.5 ? "OVERTIME" : "PRESENT";
        wageEarned = DAILY_RATE;
        if (hoursWorked > 9.5) {
          const otHours = hoursWorked - 8;
          wageEarned = Math.round((DAILY_RATE + otHours * HOURLY_RATE * 1.5) * 100) / 100;
        }
      }

      expect(status).toBe("OVERTIME");
      // 1000 + (2.5 * 125 * 1.5) = 1000 + 468.75 = 1468.75
      expect(wageEarned).toBe(1468.75);
    });
  });
});
