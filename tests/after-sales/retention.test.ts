import { describe, it, expect } from "bun:test";
import {
  createRetentionFollowUpSchema,
  updateRetentionFollowUpSchema,
  logRetentionCallSchema,
  getRetentionFollowUpsQuerySchema,
  retentionIdParamSchema,
} from "../../src/module/after-sales/validators/retention.validator.js";

describe("After-Sales: Client Retention Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_EMPLOYEE_ID = "55556666-7777-4888-8999-000011112222";
  const MOCK_RETENTION_ID = "99990000-1111-4222-8333-444455556666";

  describe("Schedule Retention Follow-Up Validation", () => {
    it("should validate full retention call scheduling payload", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        followUpType: "COURTESY_CALL_30_DAYS" as const,
        channel: "PHONE_CALL" as const,
        scheduledDate: "2026-11-15",
        assignedEmployeeId: MOCK_EMPLOYEE_ID,
        objective: "30-day post handover check-in; enquire about modular kitchen and wardrobe usage.",
        notes: "Client mentioned they would be moving in by early November.",
        additionalInformation: { source: "Handover Checklist Completion" },
      };

      const parsed = createRetentionFollowUpSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.followUpType).toBe("COURTESY_CALL_30_DAYS");
      expect(parsed.channel).toBe("PHONE_CALL");
      expect(parsed.scheduledDate).toBe("2026-11-15");
    });
  });

  describe("Log Call Outcome & Referral Lead Capture", () => {
    it("should validate call outcome logging with CSAT and referral details", () => {
      const payload = {
        conductedAt: "2026-11-15T10:30:00Z",
        notes: "Client is loving their new home and interior woodwork. Recommended Homio to their brother.",
        outcome: "NEW_LEAD_REFERRAL" as const,
        nextFollowUpDate: "2027-02-15",
        csatScore: 5.0,
        reviewLinkSent: true,
        reviewPosted: true,
        referralLeadName: "Rohit Mehta",
        referralLeadPhone: "+91 99887 76655",
        referralLeadEmail: "rohit.mehta@example.com",
      };

      const parsed = logRetentionCallSchema.parse(payload);
      expect(parsed.outcome).toBe("NEW_LEAD_REFERRAL");
      expect(parsed.csatScore).toBe(5.0);
      expect(parsed.referralLeadName).toBe("Rohit Mehta");
      expect(parsed.referralLeadEmail).toBe("rohit.mehta@example.com");
      expect(parsed.reviewPosted).toBe(true);
    });

    it("should reject log call without required notes or outcome", () => {
      expect(() =>
        logRetentionCallSchema.parse({
          notes: "",
        })
      ).toThrow();
    });
  });

  describe("Query & Param Validation", () => {
    it("should validate query filters with channel and outcome", () => {
      const query = {
        projectId: MOCK_PROJECT_ID,
        channel: "PHONE_CALL",
        outcome: "VERY_SATISFIED",
        page: "1",
        limit: "15",
      };

      const parsed = getRetentionFollowUpsQuerySchema.parse(query);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.channel).toBe("PHONE_CALL");
      expect(parsed.outcome).toBe("VERY_SATISFIED");
    });

    it("should validate retention ID param", () => {
      const parsed = retentionIdParamSchema.parse({ id: MOCK_RETENTION_ID });
      expect(parsed.id).toBe(MOCK_RETENTION_ID);
    });
  });
});
