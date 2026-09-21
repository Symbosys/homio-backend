import { describe, it, expect } from "bun:test";
import {
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  getExpenseCategoriesQuerySchema,
} from "../../src/module/projects/validators/expense-category.validator.js";

describe("Expense Categories Module Tests", () => {
  const MOCK_CATEGORY_ID = "66666666-7777-4888-9999-000000000000";

  // =========================================================================
  // 1. Create Expense Category Validation
  // =========================================================================
  describe("Create Expense Category Validation", () => {
    it("should validate full category payload with theming and tax attributes", () => {
      const payload = {
        body: {
          name: "Italian Marble & Granites",
          slug: "italian-marble-granites",
          code: "EXP-MAT-01",
          description: "Premium stone and tile materials procured for flooring and cladding",
          scope: "PROJECT" as const,
          color: "#3B82F6",
          icon: "Layers",
          isTaxDeductible: true,
          isActive: true,
        },
      };

      const parsed = createExpenseCategorySchema.parse(payload);
      expect(parsed.body.name).toBe("Italian Marble & Granites");
      expect(parsed.body.slug).toBe("italian-marble-granites");
      expect(parsed.body.scope).toBe("PROJECT");
      expect(parsed.body.color).toBe("#3B82F6");
      expect(parsed.body.isTaxDeductible).toBe(true);
    });

    it("should allow minimal category creation with default scope and tax status", () => {
      const payload = {
        body: {
          name: "Studio Rent",
        },
      };

      const parsed = createExpenseCategorySchema.parse(payload);
      expect(parsed.body.name).toBe("Studio Rent");
      expect(parsed.body.scope).toBe("PROJECT");
      expect(parsed.body.isTaxDeductible).toBe(true);
      expect(parsed.body.isActive).toBe(true);
    });

    it("should fail validation when name is too short", () => {
      const invalidPayload = {
        body: {
          name: "A",
        },
      };

      expect(() => createExpenseCategorySchema.parse(invalidPayload)).toThrow();
    });

    it("should fail validation when hex color format is invalid", () => {
      const invalidPayload = {
        body: {
          name: "Invalid Color Category",
          color: "blue-123",
        },
      };

      expect(() => createExpenseCategorySchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Update Expense Category Validation
  // =========================================================================
  describe("Update Expense Category Validation", () => {
    it("should validate partial update on category name and color", () => {
      const payload = {
        params: { id: MOCK_CATEGORY_ID },
        body: {
          name: "Imported Natural Stones",
          color: "#10B981",
          scope: "BOTH" as const,
        },
      };

      const parsed = updateExpenseCategorySchema.parse(payload);
      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
      expect(parsed.body.name).toBe("Imported Natural Stones");
      expect(parsed.body.color).toBe("#10B981");
      expect(parsed.body.scope).toBe("BOTH");
    });
  });

  // =========================================================================
  // 3. Query Filters Validation
  // =========================================================================
  describe("Get Expense Categories Query Validation", () => {
    it("should parse category list query filters", () => {
      const parsed = getExpenseCategoriesQuerySchema.parse({
        query: {
          page: "1",
          limit: "25",
          search: "Marble",
          scope: "PROJECT",
          isActive: "true",
        },
      });

      expect(parsed.query.page).toBe(1);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.search).toBe("Marble");
      expect(parsed.query.scope).toBe("PROJECT");
      expect(parsed.query.isActive).toBe(true);
    });
  });
});
