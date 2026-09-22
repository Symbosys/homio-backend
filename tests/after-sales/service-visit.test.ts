import { describe, it, expect } from "bun:test";
import {
  createServiceVisitSchema,
  updateServiceVisitSchema,
  checkInServiceVisitSchema,
  submitWorkReportSchema,
  signOffServiceVisitSchema,
  updateServiceVisitStatusSchema,
  getServiceVisitsQuerySchema,
  serviceVisitIdParamSchema,
} from "../../src/module/after-sales/validators/service-visit.validator.js";

describe("After-Sales: Field Service Visit Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_REQUEST_ID = "66667777-8888-4999-8000-111122223333";
  const MOCK_EMPLOYEE_ID = "55556666-7777-4888-8999-000011112222";
  const MOCK_VISIT_ID = "77778888-9999-4000-8111-222233334444";

  describe("Schedule Visit Validation", () => {
    it("should validate full service visit scheduling payload with direct projectId", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        serviceRequestId: MOCK_REQUEST_ID,
        visitType: "WARRANTY_RECTIFICATION" as const,
        status: "SCHEDULED" as const,
        scheduledDate: "2026-10-28",
        startTime: "11:00 AM",
        endTime: "02:00 PM",
        assignedEmployeeId: MOCK_EMPLOYEE_ID,
        contactPerson: "Mr. Vikram Mehta",
        contactNumber: "+91 98765 43210",
        specialInstructions: "Security pass required at entrance gate; flat on 12th floor.",
        additionalInformation: { toolsRequired: ["Hinges", "Screwdriver Kit"] },
      };

      const parsed = createServiceVisitSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.serviceRequestId).toBe(MOCK_REQUEST_ID);
      expect(parsed.visitType).toBe("WARRANTY_RECTIFICATION");
      expect(parsed.scheduledDate).toBe("2026-10-28");
      expect(parsed.contactPerson).toBe("Mr. Vikram Mehta");
    });

    it("should reject visit scheduling without required scheduledDate", () => {
      expect(() =>
        createServiceVisitSchema.parse({
          projectId: MOCK_PROJECT_ID,
          serviceRequestId: MOCK_REQUEST_ID,
        })
      ).toThrow();
    });
  });

  describe("Technician Check-In Validation", () => {
    it("should validate GPS coordinates and location address", () => {
      const payload = {
        checkInLatitude: 12.9715987,
        checkInLongitude: 77.5945627,
        checkInAddress: "Prestige Ferns Residency, Tower 3, Bangalore",
      };

      const parsed = checkInServiceVisitSchema.parse(payload);
      expect(parsed.checkInLatitude).toBe(12.9715987);
      expect(parsed.checkInLongitude).toBe(77.5945627);
      expect(parsed.checkInAddress).toContain("Prestige Ferns");
    });

    it("should reject out-of-range latitude/longitude", () => {
      expect(() =>
        checkInServiceVisitSchema.parse({
          checkInLatitude: 95.0, // max is 90
          checkInLongitude: 77.5,
        })
      ).toThrow();
    });
  });

  describe("Work Report & Client Sign-Off Validation", () => {
    it("should validate work report submission", () => {
      const payload = {
        diagnosisNotes: "Found hydraulic arm cylinder seal broken.",
        workPerformed: "Installed new German soft-close hydraulic struts, aligned cabinet shutter, polished face.",
        materialsUsed: "2x Hafele 150N Gas Struts, 4x Wood Screws",
        labourHours: 2.5,
      };

      const parsed = submitWorkReportSchema.parse(payload);
      expect(parsed.workPerformed).toContain("Installed new German");
      expect(parsed.labourHours).toBe(2.5);
    });

    it("should validate customer digital sign-off and CSAT rating", () => {
      const payload = {
        customerSignatureName: "Vikram Mehta",
        rating: 4.8,
      };

      const parsed = signOffServiceVisitSchema.parse(payload);
      expect(parsed.customerSignatureName).toBe("Vikram Mehta");
      expect(parsed.rating).toBe(4.8);
    });

    it("should reject signoff rating outside 1.0 to 5.0", () => {
      expect(() =>
        signOffServiceVisitSchema.parse({
          customerSignatureName: "Vikram Mehta",
          rating: 6.0,
        })
      ).toThrow();
    });
  });

  describe("Query & Param Validation", () => {
    it("should validate query filters", () => {
      const query = {
        projectId: MOCK_PROJECT_ID,
        serviceRequestId: MOCK_REQUEST_ID,
        status: "COMPLETED",
        page: "1",
        limit: "10",
      };

      const parsed = getServiceVisitsQuerySchema.parse(query);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.status).toBe("COMPLETED");
    });

    it("should validate service visit ID param", () => {
      const parsed = serviceVisitIdParamSchema.parse({ id: MOCK_VISIT_ID });
      expect(parsed.id).toBe(MOCK_VISIT_ID);
    });
  });
});
