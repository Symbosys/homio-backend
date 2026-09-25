import { describe, it, expect } from "bun:test";
import {
  createLeadFollowUpSchema,
  updateLeadFollowUpSchema,
  getFollowUpsQuerySchema,
  followUpIdParamSchema,
} from "../../src/module/leads-crm/validators/lead-followup.validator";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_LEAD_ID,
  MOCK_EMPLOYEE_ID_1,
} from "./fixtures/crm.fixtures";

describe("Follow-ups API & Quality Test Suite", () => {
  // =========================================================================
  // 1. Scheduling & Creation Validation
  // =========================================================================
  describe("Schedule Follow-up Validation", () => {
    it("should validate scheduling a new call follow-up with assigned employee", () => {
      const payload = {
        body: {
          leadId: MOCK_LEAD_ID,
          type: "CALLBACK" as const,
          scheduledAt: "2026-09-25T10:00:00.000Z",
          remindAt: "2026-09-25T09:45:00.000Z",
          agenda: "Follow up regarding 3D kitchen design quote approval",
          assignedToId: MOCK_EMPLOYEE_ID_1,
        },
      };

      const result = createLeadFollowUpSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.leadId).toBe(MOCK_LEAD_ID);
        expect(result.data.body.type).toBe("CALLBACK");
        expect(result.data.body.assignedToId).toBe(MOCK_EMPLOYEE_ID_1);
      }
    });

    it("should reject scheduling when agenda or scheduledAt is missing", () => {
      const invalidPayload = {
        body: {
          leadId: MOCK_LEAD_ID,
          agenda: "",
          scheduledAt: "invalid-date",
        },
      };

      const result = createLeadFollowUpSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Status Transitions & Outcomes
  // =========================================================================
  describe("Follow-up Status Transitions & Rescheduling", () => {
    it("should validate completing a follow-up with outcome notes", () => {
      const completePayload = {
        params: { id: "3f8202d2-8b4d-44a6-93d3-7d8b5fc241a3" },
        body: {
          status: "COMPLETED" as const,
          outcomeNotes: "Client agreed to the design estimate. Scheduled site measurement for Monday.",
          completedAt: "2026-09-25T10:30:00.000Z",
        },
      };

      const result = updateLeadFollowUpSchema.safeParse(completePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.status).toBe("COMPLETED");
        expect(result.data.body.outcomeNotes).toContain("Client agreed");
      }
    });

    it("should validate rescheduling a follow-up with new date and time", () => {
      const reschedulePayload = {
        params: { id: "3f8202d2-8b4d-44a6-93d3-7d8b5fc241a3" },
        body: {
          status: "RESCHEDULED" as const,
          scheduledAt: "2026-09-28T14:00:00.000Z",
          remindAt: "2026-09-28T13:45:00.000Z",
          agenda: "Rescheduled client call - client was traveling",
        },
      };

      const result = updateLeadFollowUpSchema.safeParse(reschedulePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.status).toBe("RESCHEDULED");
        expect(result.data.body.scheduledAt).toBe("2026-09-28T14:00:00.000Z");
      }
    });

    it("should accept CANCELLED and MISSED status transitions", () => {
      const cancelPayload = {
        params: { id: "3f8202d2-8b4d-44a6-93d3-7d8b5fc241a3" },
        body: {
          status: "CANCELLED" as const,
          outcomeNotes: "Client opted for another service provider",
        },
      };
      expect(updateLeadFollowUpSchema.safeParse(cancelPayload).success).toBe(true);

      const missedPayload = {
        params: { id: "3f8202d2-8b4d-44a6-93d3-7d8b5fc241a3" },
        body: {
          status: "MISSED" as const,
          outcomeNotes: "Customer phone unreachable after 3 attempts",
        },
      };
      expect(updateLeadFollowUpSchema.safeParse(missedPayload).success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Query Filtering (Date Range, Employee, Status, Type, Search)
  // =========================================================================
  describe("Follow-up Query Filters & Date Ranges", () => {
    it("should validate query filters with start and end dates", () => {
      const queryPayload = {
        query: {
          page: "1",
          limit: "25",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          status: "PENDING",
          type: "SITE_VISIT",
          assignedToId: MOCK_EMPLOYEE_ID_1,
          search: "Oberoi Sky City",
        },
      };

      const result = getFollowUpsQuerySchema.safeParse(queryPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.startDate).toBe("2026-09-01");
        expect(result.data.query.endDate).toBe("2026-09-30");
        expect(result.data.query.status).toBe("PENDING");
        expect(result.data.query.type).toBe("SITE_VISIT");
        expect(result.data.query.assignedToId).toBe(MOCK_EMPLOYEE_ID_1);
        expect(result.data.query.search).toBe("Oberoi Sky City");
      }
    });

    it("should accept alternative date range keys fromScheduledAt and toScheduledAt", () => {
      const queryPayload = {
        query: {
          fromScheduledAt: "2026-09-20T00:00:00.000Z",
          toScheduledAt: "2026-09-27T23:59:59.999Z",
        },
      };

      const result = getFollowUpsQuerySchema.safeParse(queryPayload);
      expect(result.success).toBe(true);
    });
  });
});
