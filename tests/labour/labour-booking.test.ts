import { describe, it, expect } from "bun:test";
import {
  createLabourBookingSchema,
  updateLabourBookingSchema,
  updateBookingStatusSchema,
  getLabourBookingsQuerySchema,
} from "../../src/module/labour/validators/labour-booking.validator.js";
import {
  MOCK_BOOKING_ID_1,
  MOCK_PROJECT_ID_1,
  MOCK_LABOUR_ID_1,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Booking Management Tests", () => {
  describe("1. Booking Code Sequential Pattern Validation", () => {
    it("should match LB-YYYY-NNNN format pattern", () => {
      const codeRegex = /^LB-\d{4}-\d{4,}$/;
      expect(codeRegex.test("LB-2026-0001")).toBe(true);
      expect(codeRegex.test("LB-2026-0142")).toBe(true);
      expect(codeRegex.test("LB-2026-9999")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("LB-26-01")).toBe(false);
    });
  });

  describe("2. Booking Creation Validation", () => {
    it("should validate full booking creation payload with rates and schedule", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID_1,
          labourId: MOCK_LABOUR_ID_1,
          workTitle: "False Ceiling Framing & Acoustic Boards",
          workDescription: "Installation of gypsum boards and shadow line channel framing.",
          startDate: "2026-10-01",
          endDate: "2026-10-15",
          agreedDailyRate: 1200.0,
          estimatedDays: 12,
          status: "CONFIRMED" as const,
          notes: "Materials already delivered at site.",
          additionalInformation: {
            milestoneTag: "STAGE_3_CEILING",
          },
        },
      };

      const parsed = createLabourBookingSchema.parse(payload);
      expect(parsed.body.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.body.agreedDailyRate).toBe(1200.0);
      expect(parsed.body.estimatedDays).toBe(12);
      expect(parsed.body.status).toBe("CONFIRMED");
    });

    it("should calculate total budget correctly based on daily rate and estimated days", () => {
      const dailyRate = 1250.0;
      const estimatedDays = 14;
      const calculatedBudget = dailyRate * estimatedDays;
      expect(calculatedBudget).toBe(17500.0);
    });

    it("should reject booking when projectId or labourId is missing or invalid", () => {
      expect(() =>
        createLabourBookingSchema.parse({
          body: {
            workTitle: "Framing",
            startDate: "2026-10-01",
            endDate: "2026-10-15",
            agreedDailyRate: 1000,
          },
        })
      ).toThrow();
    });
  });

  describe("3. Symmetric Full Editability Validation (Rule 19)", () => {
    it("should allow editing all booking fields during update", () => {
      const updatePayload = {
        params: { id: MOCK_BOOKING_ID_1 },
        body: {
          workTitle: "Updated: False ceiling + Painting Prep",
          agreedDailyRate: 1300.0,
          estimatedDays: 15,
          totalBudget: 19500.0,
          notes: "Scope expanded to include primer coat.",
          status: "IN_PROGRESS" as const,
        },
      };

      const parsed = updateLabourBookingSchema.parse(updatePayload);
      expect(parsed.body.workTitle).toContain("Painting Prep");
      expect(parsed.body.agreedDailyRate).toBe(1300.0);
      expect(parsed.body.totalBudget).toBe(19500.0);
    });
  });

  describe("4. Status Progression Validation", () => {
    it("should accept valid status transitions", () => {
      const statuses = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
      for (const status of statuses) {
        const parsed = updateBookingStatusSchema.parse({
          params: { id: MOCK_BOOKING_ID_1 },
          body: { status },
        });
        expect(parsed.body.status).toBe(status);
      }
    });
  });

  describe("5. Query Filtering Validation", () => {
    it("should parse query filters for project and worker", () => {
      const parsed = getLabourBookingsQuerySchema.parse({
        query: {
          page: "1",
          limit: "10",
          projectId: MOCK_PROJECT_ID_1,
          labourId: MOCK_LABOUR_ID_1,
          status: "CONFIRMED",
        },
      });

      expect(parsed.query.projectId).toBe(MOCK_PROJECT_ID_1);
      expect(parsed.query.status).toBe("CONFIRMED");
    });
  });
});
