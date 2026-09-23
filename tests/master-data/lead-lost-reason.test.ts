import { describe, it, expect } from "bun:test";
import {
  createLeadLostReasonSchema,
  updateLeadLostReasonSchema,
  getLeadLostReasonsQuerySchema,
  leadLostReasonIdParamSchema,
} from "../../src/module/master-data/validators/lead-lost-reason.validator.js";

describe("Master Data: Lead Lost Reason Tests", () => {
  const MOCK_REASON_ID = "b0000000-0000-4000-8000-000000000002";

  describe("Create Lead Lost Reason Validation", () => {
    it("should validate full lead lost reason payload with workflow rules and additionalInformation", () => {
      const payload = {
        name: "Competitor - Livspace",
        slug: "competitor-livspace",
        code: "LOST-COMP-01",
        group: "COMPETITOR" as const,
        description: "Client chose Livspace due to aggressive festive promotional discounts.",
        color: "#EF4444",
        icon: "Users",
        requiresRemarks: true,
        requiresCompetitor: true,
        isDefault: false,
        isActive: true,
        sortOrder: 1,
        additionalInformation: {
          marketSegment: "Mid-to-High",
        },
      };

      const parsed = createLeadLostReasonSchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Competitor - Livspace");
      expect(parsed.body.group).toBe("COMPETITOR");
      expect(parsed.body.requiresRemarks).toBe(true);
      expect(parsed.body.requiresCompetitor).toBe(true);
      expect(parsed.body.color).toBe("#EF4444");
      expect(parsed.body.additionalInformation).toEqual({ marketSegment: "Mid-to-High" });
    });

    it("should allow minimal payload with defaults", () => {
      const payload = {
        name: "Budget Mismatch",
      };

      const parsed = createLeadLostReasonSchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Budget Mismatch");
      expect(parsed.body.group).toBe("OTHER");
      expect(parsed.body.requiresRemarks).toBe(false);
      expect(parsed.body.requiresCompetitor).toBe(false);
      expect(parsed.body.isActive).toBe(true);
    });

    it("should reject creation with invalid HEX color format", () => {
      const payload = {
        name: "Invalid Color",
        color: "red", // Not a hex code
      };

      expect(() => createLeadLostReasonSchema.parse({ body: payload })).toThrow();
    });

    it("should reject creation with invalid reason group", () => {
      const payload = {
        name: "Unknown Group",
        group: "NON_EXISTENT_GROUP",
      };

      expect(() => createLeadLostReasonSchema.parse({ body: payload })).toThrow();
    });
  });

  describe("Update Lead Lost Reason Validation", () => {
    it("should validate partial updates (dirty fields)", () => {
      const payload = {
        requiresRemarks: true,
        color: "#DC2626",
        additionalInformation: { reviewed: true },
      };

      const parsed = updateLeadLostReasonSchema.parse({
        params: { id: MOCK_REASON_ID },
        body: payload,
      });

      expect(parsed.params.id).toBe(MOCK_REASON_ID);
      expect(parsed.body.requiresRemarks).toBe(true);
      expect(parsed.body.color).toBe("#DC2626");
      expect(parsed.body.additionalInformation).toEqual({ reviewed: true });
    });
  });

  describe("Query Parameters Validation", () => {
    it("should parse query with filter by group and search", () => {
      const query = {
        page: "1",
        limit: "20",
        group: "PRICING",
        search: "budget",
      };

      const parsed = getLeadLostReasonsQuerySchema.parse({ query });
      expect(parsed.query.group).toBe("PRICING");
      expect(parsed.query.search).toBe("budget");
    });
  });

  describe("Param ID Validation", () => {
    it("should accept valid UUID", () => {
      const parsed = leadLostReasonIdParamSchema.parse({ params: { id: MOCK_REASON_ID } });
      expect(parsed.params.id).toBe(MOCK_REASON_ID);
    });

    it("should reject malformed UUID", () => {
      expect(() => leadLostReasonIdParamSchema.parse({ params: { id: "bad-uuid" } })).toThrow();
    });
  });
});
