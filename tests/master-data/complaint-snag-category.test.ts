import { describe, it, expect } from "bun:test";
import {
  createComplaintSnagCategorySchema,
  updateComplaintSnagCategorySchema,
  getComplaintSnagCategoriesQuerySchema,
  complaintSnagCategoryIdParamSchema,
} from "../../src/module/master-data/validators/complaint-snag-category.validator.js";

describe("Master Data: Complaint & Snag Category Tests", () => {
  const MOCK_CATEGORY_ID = "d0000000-0000-4000-8000-000000000004";

  describe("Create Complaint & Snag Category Validation", () => {
    it("should validate full category payload with scope, defaults, and additionalInformation", () => {
      const payload = {
        name: "Tile Alignment & Grouting",
        slug: "tile-alignment-grouting",
        code: "SNAG-CIVIL-01",
        scope: "BOTH" as const,
        description: "Misaligned wall or floor tiles, hollow sound beneath tiles, chipped grouting.",
        color: "#F59E0B",
        icon: "AlertTriangle",
        defaultSeverity: "HIGH" as const,
        defaultResolutionDays: 2,
        isDefault: false,
        isActive: true,
        sortOrder: 1,
        additionalInformation: {
          tradeResponsible: "Civil Contractor",
          inspectionChecklistCode: "CHK-TILE-04",
        },
      };

      const parsed = createComplaintSnagCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Tile Alignment & Grouting");
      expect(parsed.body.scope).toBe("BOTH");
      expect(parsed.body.defaultSeverity).toBe("HIGH");
      expect(parsed.body.defaultResolutionDays).toBe(2);
      expect(parsed.body.additionalInformation).toEqual({
        tradeResponsible: "Civil Contractor",
        inspectionChecklistCode: "CHK-TILE-04",
      });
    });

    it("should allow minimal category payload with default scope and severity", () => {
      const payload = {
        name: "Plumbing Leakage",
      };

      const parsed = createComplaintSnagCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Plumbing Leakage");
      expect(parsed.body.scope).toBe("BOTH");
      expect(parsed.body.defaultSeverity).toBe("MEDIUM");
      expect(parsed.body.defaultResolutionDays).toBe(3);
      expect(parsed.body.isActive).toBe(true);
    });

    it("should reject creation with invalid scope", () => {
      const payload = {
        name: "Paint Touchup",
        scope: "INVALID_SCOPE",
      };

      expect(() => createComplaintSnagCategorySchema.parse({ body: payload })).toThrow();
    });
  });

  describe("Update Complaint & Snag Category Validation", () => {
    it("should validate partial updates", () => {
      const payload = {
        defaultResolutionDays: 1,
        color: "#D97706",
        additionalInformation: { priorityLevel: "Critical Punchlist" },
      };

      const parsed = updateComplaintSnagCategorySchema.parse({
        params: { id: MOCK_CATEGORY_ID },
        body: payload,
      });

      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
      expect(parsed.body.defaultResolutionDays).toBe(1);
      expect(parsed.body.additionalInformation).toEqual({ priorityLevel: "Critical Punchlist" });
    });
  });

  describe("Query Parameters Validation", () => {
    it("should parse query with scope filter", () => {
      const query = {
        scope: "SNAG",
        isActive: "true",
      };

      const parsed = getComplaintSnagCategoriesQuerySchema.parse({ query });
      expect(parsed.query.scope).toBe("SNAG");
      expect(parsed.query.isActive).toBe(true);
    });
  });

  describe("Param ID Validation", () => {
    it("should accept valid UUID", () => {
      const parsed = complaintSnagCategoryIdParamSchema.parse({ params: { id: MOCK_CATEGORY_ID } });
      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
    });
  });
});
