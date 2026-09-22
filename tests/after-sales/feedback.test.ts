import { describe, it, expect } from "bun:test";
import {
  createCustomerFeedbackSchema,
  updateCustomerFeedbackSchema,
  escalateFeedbackSchema,
  resolveEscalationSchema,
  getCustomerFeedbacksQuerySchema,
  feedbackIdParamSchema,
} from "../../src/module/after-sales/validators/feedback.validator.js";

describe("After-Sales: Customer Feedback & CSAT Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";
  const MOCK_REQUEST_ID = "66667777-8888-4999-8000-111122223333";
  const MOCK_VISIT_ID = "77778888-9999-4000-8111-222233334444";
  const MOCK_FEEDBACK_ID = "88889999-0000-4111-8222-333344445555";

  describe("Create Feedback Validation", () => {
    it("should validate full 5-pillar CSAT feedback with direct projectId", () => {
      const payload = {
        projectId: MOCK_PROJECT_ID,
        serviceRequestId: MOCK_REQUEST_ID,
        serviceVisitId: MOCK_VISIT_ID,
        touchpoint: "POST_SERVICE",
        overallRating: 4.5,
        qualityRating: 5.0,
        timelinessRating: 4.0,
        professionalismRating: 4.5,
        communicationRating: 4.5,
        issueResolvedAnswer: "YES" as const,
        whatWentWell: "Technician arrived on time, wore shoe covers, and fixed the hydraulic lift quickly.",
        whatCouldImprove: "Provide SMS updates on live technician tracking.",
        customerComments: "Very happy with the overall after-sales response.",
        additionalInformation: { channel: "WhatsApp CSAT Bot" },
      };

      const parsed = createCustomerFeedbackSchema.parse(payload);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.overallRating).toBe(4.5);
      expect(parsed.qualityRating).toBe(5.0);
      expect(parsed.issueResolvedAnswer).toBe("YES");
    });

    it("should reject overall rating below 1.0 or above 5.0", () => {
      expect(() =>
        createCustomerFeedbackSchema.parse({
          projectId: MOCK_PROJECT_ID,
          overallRating: 0.5,
        })
      ).toThrow();

      expect(() =>
        createCustomerFeedbackSchema.parse({
          projectId: MOCK_PROJECT_ID,
          overallRating: 5.5,
        })
      ).toThrow();
    });
  });

  describe("Escalation & Resolution Validation", () => {
    it("should validate escalating dissatisfied feedback to management", () => {
      const payload = {
        escalationReason: "Customer rated 1.5 due to repeated delay in resolving wardrobe door alignment.",
      };

      const parsed = escalateFeedbackSchema.parse(payload);
      expect(parsed.escalationReason).toContain("repeated delay");
    });

    it("should reject escalation with empty or very short reason", () => {
      expect(() => escalateFeedbackSchema.parse({ escalationReason: "bad" })).toThrow();
    });

    it("should validate manager resolution notes", () => {
      const payload = {
        managerNotes: "Called client personally, dispatched senior quality manager for re-inspection, offered complimentary service.",
      };

      const parsed = resolveEscalationSchema.parse(payload);
      expect(parsed.managerNotes).toContain("senior quality manager");
    });
  });

  describe("Query & Param Validation", () => {
    it("should validate query filters with rating ranges and escalation flag", () => {
      const query = {
        projectId: MOCK_PROJECT_ID,
        minRating: "4.0",
        maxRating: "5.0",
        isEscalated: "false",
        page: "1",
        limit: "20",
      };

      const parsed = getCustomerFeedbacksQuerySchema.parse(query);
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.minRating).toBe(4.0);
      expect(parsed.isEscalated).toBe(false);
    });

    it("should validate feedback ID param", () => {
      const parsed = feedbackIdParamSchema.parse({ id: MOCK_FEEDBACK_ID });
      expect(parsed.id).toBe(MOCK_FEEDBACK_ID);
    });
  });
});
