import { describe, it, expect } from "bun:test";
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  getServiceCategoriesQuerySchema,
  categoryIdParamSchema,
} from "../../src/module/after-sales/validators/category.validator.js";

describe("After-Sales: Service Category Tests", () => {
  const MOCK_CATEGORY_ID = "99991111-2222-4333-8444-555566667777";

  describe("Create Category Validation", () => {
    it("should validate full category payload", () => {
      const payload = {
        name: "Carpentry & Joinery",
        slug: "carpentry-joinery",
        code: "CAT-WOOD",
        description: "Door alignments, hinge replacements, wardrobe repairs and custom woodwork.",
        icon: "hammer",
        color: "#8B5CF6",
        defaultSlaHours: 48,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
        additionalInformation: { warrantyType: "Standard 1-Year" },
      };

      const parsed = createServiceCategorySchema.parse(payload);
      expect(parsed.name).toBe("Carpentry & Joinery");
      expect(parsed.defaultSlaHours).toBe(48);
      expect(parsed.isActive).toBe(true);
      expect(parsed.additionalInformation).toEqual({ warrantyType: "Standard 1-Year" });
    });

    it("should allow minimal category payload with default SLA and active flag", () => {
      const payload = {
        name: "Deep Cleaning & Polishing",
      };

      const parsed = createServiceCategorySchema.parse(payload);
      expect(parsed.name).toBe("Deep Cleaning & Polishing");
      expect(parsed.defaultSlaHours).toBe(48);
      expect(parsed.isActive).toBe(true);
      expect(parsed.sortOrder).toBe(0);
    });

    it("should reject creation when name is shorter than 2 characters", () => {
      expect(() => createServiceCategorySchema.parse({ name: "A" })).toThrow();
    });
  });

  describe("Update Category Validation", () => {
    it("should validate partial updates (dirty fields)", () => {
      const payload = {
        defaultSlaHours: 24,
        color: "#10B981",
        isActive: false,
      };

      const parsed = updateServiceCategorySchema.parse(payload);
      expect(parsed.defaultSlaHours).toBe(24);
      expect(parsed.color).toBe("#10B981");
      expect(parsed.isActive).toBe(false);
      expect(parsed.name).toBeUndefined();
    });
  });

  describe("Query and Param Validation", () => {
    it("should parse query parameters with defaults", () => {
      const query = {
        search: "plumbing",
        isActive: "true",
        page: "2",
        limit: "15",
      };

      const parsed = getServiceCategoriesQuerySchema.parse(query);
      expect(parsed.search).toBe("plumbing");
      expect(parsed.isActive).toBe(true);
      expect(parsed.page).toBe(2);
      expect(parsed.limit).toBe(15);
    });

    it("should validate category ID param", () => {
      const parsed = categoryIdParamSchema.parse({ id: MOCK_CATEGORY_ID });
      expect(parsed.id).toBe(MOCK_CATEGORY_ID);

      expect(() => categoryIdParamSchema.parse({ id: "invalid-uuid" })).toThrow();
    });
  });
});
