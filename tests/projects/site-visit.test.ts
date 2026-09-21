import { describe, it, expect } from "bun:test";
import {
  createSiteVisitSchema,
  updateSiteVisitSchema,
  completeSiteVisitSchema,
  getSiteVisitsQuerySchema,
} from "../../src/module/projects/validators/site-visit.validator.js";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Project Site Visits & Field Inspections Module Tests", () => {
  const MOCK_SITE_VISIT_ID = "55555555-6666-4777-8888-999999999999";
  const MOCK_MILESTONE_ID = "44444444-5555-4666-8777-888888888888";

  // =========================================================================
  // 1. Create Site Visit Validation
  // =========================================================================
  describe("Create Site Visit Validation", () => {
    it("should validate full site visit payload with GPS and attachments", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          visitType: "MATERIAL_INSPECTION" as const,
          status: "SCHEDULED" as const,
          plannedDate: "2026-10-15",
          plannedStartTime: "10:30 AM",
          plannedEndTime: "01:30 PM",
          purpose: "Inspect batch of Italian Statuario marble slabs delivered at site",
          milestoneId: MOCK_MILESTONE_ID,
          visitorEmployeeId: MOCK_EMPLOYEE_ID_1,
          clientRepresentative: "Mr. Rajesh Khanna",
          locationGpsLat: 19.076,
          locationGpsLng: 72.8777,
          attachments: [
            {
              id: "photo-01",
              url: "https://storage.homio.in/visits/marble-slab-01.webp",
              bytes: 1048576,
              format: "webp",
              provider: "AWS_S3" as const,
            },
          ],
        },
      };

      const parsed = createSiteVisitSchema.parse(payload);
      expect(parsed.params?.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.visitType).toBe("MATERIAL_INSPECTION");
      expect(parsed.body.status).toBe("SCHEDULED");
      expect(parsed.body.plannedDate).toBe("2026-10-15");
      expect(parsed.body.locationGpsLat).toBe(19.076);
      expect(parsed.body.attachments?.length).toBe(1);
    });

    it("should allow minimal site visit scheduling with only plannedDate", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          plannedDate: "2026-11-01",
        },
      };

      const parsed = createSiteVisitSchema.parse(payload);
      expect(parsed.body.plannedDate).toBe("2026-11-01");
      expect(parsed.body.visitType).toBe("EXECUTION");
      expect(parsed.body.status).toBe("SCHEDULED");
    });

    it("should fail validation when plannedDate is invalid or missing", () => {
      const invalidPayload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          plannedDate: "invalid-date",
        },
      };

      expect(() => createSiteVisitSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Site Visit Validation
  // =========================================================================
  describe("Update Site Visit Validation", () => {
    it("should validate partial update on site visit schedule", () => {
      const payload = {
        params: { id: MOCK_SITE_VISIT_ID },
        body: {
          plannedDate: "2026-10-20",
          plannedStartTime: "02:00 PM",
          visitorEmployeeId: MOCK_EMPLOYEE_ID_1,
          purpose: "Rescheduled measurement due to site plaster curing",
        },
      };

      const parsed = updateSiteVisitSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_SITE_VISIT_ID);
      expect(parsed.body.plannedDate).toBe("2026-10-20");
      expect(parsed.body.visitorEmployeeId).toBe(MOCK_EMPLOYEE_ID_1);
    });
  });

  // =========================================================================
  // 3. Complete Site Visit Validation
  // =========================================================================
  describe("Complete Site Visit Validation", () => {
    it("should validate completing visit with inspection findings and snags", () => {
      const payload = {
        params: { id: MOCK_SITE_VISIT_ID },
        body: {
          actualDate: "2026-10-15",
          actualStartTime: "10:45 AM",
          actualEndTime: "01:15 PM",
          outcome: "ISSUES_FOUND" as const,
          summary: "Inspected marble slabs; 3 out of 12 slabs have micro hairline cracks.",
          issuesIdentified: "Cracks observed on Lot #4 slab batch.",
          actionItems: "Vendor to replace 3 cracked slabs before installation by Oct 20.",
        },
      };

      const parsed = completeSiteVisitSchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_SITE_VISIT_ID);
      expect(parsed.body.outcome).toBe("ISSUES_FOUND");
      expect(parsed.body.summary).toContain("micro hairline cracks");
    });
  });

  // =========================================================================
  // 4. Query Filters Validation
  // =========================================================================
  describe("Get Site Visits Query Validation", () => {
    it("should parse query filters with defaults", () => {
      const parsed = getSiteVisitsQuerySchema.parse({
        query: {
          page: "2",
          limit: "15",
          visitType: "MEASUREMENT",
          status: "COMPLETED",
          startDate: "2026-10-01",
          endDate: "2026-10-31",
        },
      });

      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(15);
      expect(parsed.query.visitType).toBe("MEASUREMENT");
      expect(parsed.query.status).toBe("COMPLETED");
      expect(parsed.query.startDate).toBe("2026-10-01");
    });
  });
});
