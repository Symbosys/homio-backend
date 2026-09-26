import { describe, it, expect } from "bun:test";
import {
  createTimelineSchema,
  updateTimelineSchema,
  getTimelinesQuerySchema,
  timelineIdParamSchema,
  timelineProjectIdParamSchema,
} from "../../src/module/projects/validators/timeline.validator.js";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
} from "../leads-crm/fixtures/crm.fixtures.js";

describe("Project Timeline Module Validation Tests", () => {
  // =========================================================================
  // 1. Create Project Timeline Event Validation
  // =========================================================================
  describe("Create Timeline Event Validation", () => {
    it("should validate creating a system-generated project creation timeline event", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Project Created & Initialized",
          description: "Project onboarded from won CRM lead #LD-2026-0042.",
          eventType: "PROJECT_CREATED" as const,
          category: "ONBOARDING",
          status: "COMPLETED" as const,
          eventDate: "2026-10-01T09:00:00.000Z",
          isCustom: false,
          isSystemGenerated: true,
          performedById: MOCK_EMPLOYEE_ID_1,
        },
      };

      const parsed = createTimelineSchema.parse(payload);
      expect(parsed.params?.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.title).toBe("Project Created & Initialized");
      expect(parsed.body.eventType).toBe("PROJECT_CREATED");
      expect(parsed.body.category).toBe("ONBOARDING");
      expect(parsed.body.status).toBe("COMPLETED");
      expect(parsed.body.isCustom).toBe(false);
      expect(parsed.body.isSystemGenerated).toBe(true);
      expect(parsed.body.performedById).toBe(MOCK_EMPLOYEE_ID_1);
    });

    it("should validate creating a custom timeline event with media attachments and custom additional information", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Custom Site Survey & Laser Measurement",
          description: "Completed laser scanning of drawing room and kitchen as-built dimensions.",
          eventType: "SITE_VISIT" as const,
          category: "MEASUREMENT",
          status: "COMPLETED" as const,
          eventDate: "2026-10-05T14:30:00.000Z",
          orderIndex: 2,
          performedById: MOCK_EMPLOYEE_ID_2,
          isCustom: true,
          isSystemGenerated: false,
          attachments: [
            {
              id: "img-timeline-01",
              url: "https://storage.homio.in/projects/laser-survey-drawing.jpg",
              bytes: 2048576,
              format: "jpeg",
              provider: "AWS_S3",
            },
          ],
          metadata: {
            laserDevice: "Leica Disto D2",
            accuracyMm: 1.5,
          },
          additionalInformation: {
            siteNotes: "Caretaker granted access via Gate 1",
            powerSupplyStatus: "Temporary connection active",
          },
        },
      };

      const parsed = createTimelineSchema.parse(payload);
      expect(parsed.body.title).toBe("Custom Site Survey & Laser Measurement");
      expect(parsed.body.eventType).toBe("SITE_VISIT");
      expect(parsed.body.isCustom).toBe(true);
      expect(parsed.body.attachments?.length).toBe(1);
      expect(parsed.body.metadata?.laserDevice).toBe("Leica Disto D2");
      expect(parsed.body.additionalInformation?.powerSupplyStatus).toBe("Temporary connection active");
    });

    it("should reject creation when title is empty", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "",
          eventType: "CUSTOM_EVENT",
        },
      };

      expect(() => createTimelineSchema.parse(payload)).toThrow();
    });

    it("should reject creation with invalid eventType", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          title: "Invalid Event",
          eventType: "NON_EXISTENT_TYPE" as any,
        },
      };

      expect(() => createTimelineSchema.parse(payload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Timeline Event Validation
  // =========================================================================
  describe("Update Timeline Event Validation", () => {
    it("should validate partial update on timeline event", () => {
      const payload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "12345678-1234-4234-8234-123456789012",
        },
        body: {
          title: "Updated Milestone Sign-off Title",
          status: "COMPLETED" as const,
          description: "All client feedback incorporated and signed off.",
        },
      };

      const parsed = updateTimelineSchema.parse(payload);
      expect(parsed.params.id).toBe("12345678-1234-4234-8234-123456789012");
      expect(parsed.body.title).toBe("Updated Milestone Sign-off Title");
      expect(parsed.body.status).toBe("COMPLETED");
    });
  });

  // =========================================================================
  // 3. Query & Parameter Validation
  // =========================================================================
  describe("Query & Parameter Validation", () => {
    it("should validate query parameters for listing timelines with filters", () => {
      const queryPayload = {
        params: { projectId: MOCK_PROJECT_ID },
        query: {
          page: "1",
          limit: "25",
          search: "Survey",
          eventType: "SITE_VISIT",
          isCustom: "true",
          sortBy: "eventDate",
          sortOrder: "desc",
        },
      };

      const parsed = getTimelinesQuerySchema.parse(queryPayload);
      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.search).toBe("Survey");
      expect(parsed.query.eventType).toBe("SITE_VISIT");
      expect(parsed.query.isCustom).toBe(true);
      expect(parsed.query.sortBy).toBe("eventDate");
      expect(parsed.query.sortOrder).toBe("desc");
    });

    it("should validate timeline param IDs", () => {
      const validParams = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
      };
      expect(() => timelineIdParamSchema.parse(validParams)).not.toThrow();

      const invalidParams = {
        params: {
          id: "not-a-uuid",
        },
      };
      expect(() => timelineIdParamSchema.parse(invalidParams)).toThrow();
    });
  });
});
