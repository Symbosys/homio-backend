import { describe, it, expect } from "bun:test";
import {
  createCategorySchema,
  updateCategorySchema,
  getCategoryQuerySchema,
  categoryIdParamSchema,
} from "../../src/module/marketplace/validators/category.validator.js";
import {
  MOCK_CATEGORY_HOME_DECOR_ID,
  MOCK_CATEGORY_MATERIALS_ID,
} from "./fixtures/marketplace.fixtures.js";

describe("Marketplace Category Module Tests", () => {
  // =========================================================================
  // 1. Create Category Validation
  // =========================================================================
  describe("Create Marketplace Category Validation", () => {
    it("should validate category creation with valid marketplaceType and commissionRate", () => {
      const payload = {
        body: {
          name: "Luxury Living Room Furniture",
          code: "CAT-LIVING-FURN",
          slug: "luxury-living-room-furniture",
          marketplaceType: "HOME_DECOR" as const,
          description: "Premium sofas, coffee tables, and accent chairs for modern homes",
          commissionRate: 7.5,
          sortOrder: 1,
          isActive: true,
        },
      };

      const result = createCategorySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Luxury Living Room Furniture");
        expect(result.data.body.code).toBe("CAT-LIVING-FURN");
        expect(result.data.body.marketplaceType).toBe("HOME_DECOR");
        expect(result.data.body.commissionRate).toBe(7.5);
      }
    });

    it("should allow category creation with default commissionRate fallback (5%)", () => {
      const payload = {
        body: {
          name: "Raw Construction Materials",
          code: "CAT-RAW-MAT",
          marketplaceType: "MATERIALS" as const,
        },
      };

      const result = createCategorySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.commissionRate).toBe(5);
        expect(result.data.body.marketplaceType).toBe("MATERIALS");
      }
    });

    it("should reject category creation with invalid marketplaceType", () => {
      const payload = {
        body: {
          name: "Invalid Vertical",
          code: "CAT-INVALID",
          marketplaceType: "UNKNOWN_TYPE" as any,
        },
      };

      const result = createCategorySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject category creation with negative or exceeding commission rate", () => {
      const negativeRate = {
        body: {
          name: "Building Supplies",
          code: "CAT-BLD-01",
          marketplaceType: "MATERIALS" as const,
          commissionRate: -2.5,
        },
      };
      expect(createCategorySchema.safeParse(negativeRate).success).toBe(false);

      const excessiveRate = {
        body: {
          name: "Building Supplies",
          code: "CAT-BLD-01",
          marketplaceType: "MATERIALS" as const,
          commissionRate: 105,
        },
      };
      expect(createCategorySchema.safeParse(excessiveRate).success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Update Category Validation
  // =========================================================================
  describe("Update Marketplace Category Validation", () => {
    it("should allow partial (dirty payload) updates to commission rate and active status", () => {
      const payload = {
        params: {
          id: MOCK_CATEGORY_HOME_DECOR_ID,
        },
        body: {
          commissionRate: 8.0,
          isActive: false,
        },
      };

      const result = updateCategorySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.commissionRate).toBe(8.0);
        expect(result.data.body.isActive).toBe(false);
      }
    });

    it("should reject updates with malformed UUID in params", () => {
      const payload = {
        params: {
          id: "not-a-uuid",
        },
        body: {
          name: "Updated Name",
        },
      };

      const result = updateCategorySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Category Query Parameters Validation
  // =========================================================================
  describe("Query Categories Validation", () => {
    it("should validate category search and filter queries", () => {
      const query = {
        query: {
          marketplaceType: "MATERIALS" as const,
          isActive: "true",
          search: "Cement",
          page: "1",
          limit: "20",
        },
      };

      const result = getCategoryQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.marketplaceType).toBe("MATERIALS");
        expect(result.data.query.isActive).toBe(true);
        expect(result.data.query.search).toBe("Cement");
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(20);
      }
    });
  });
});
