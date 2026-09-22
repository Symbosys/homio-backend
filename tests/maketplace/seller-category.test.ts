import { describe, it, expect } from "bun:test";
import {
  registerSellerCategorySchema,
  updateSellerCategoryCommissionSchema,
  getSellerCategoriesQuerySchema,
  sellerCategoryIdParamSchema,
} from "../../src/module/marketplace/validators/seller-category.validator.js";
import {
  MOCK_CATEGORY_HOME_DECOR_ID,
  MOCK_SELLER_CATEGORY_ID_1,
} from "./fixtures/marketplace.fixtures.js";

describe("Seller Category & Commission Inheritance Module Tests", () => {
  // =========================================================================
  // 1. Seller Category Registration Validation
  // =========================================================================
  describe("Register Seller Category Validation", () => {
    it("should validate seller category registration payload", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
        },
      };

      const result = registerSellerCategorySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.categoryId).toBe(MOCK_CATEGORY_HOME_DECOR_ID);
      }
    });

    it("should reject registration when categoryId is invalid UUID", () => {
      const payload = {
        body: {
          categoryId: "invalid-uuid",
        },
      };

      const result = registerSellerCategorySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Platform Admin Commission Override Validation
  // =========================================================================
  describe("Platform Admin Commission Override Validation", () => {
    it("should validate commission rate override payload within 0-100%", () => {
      const payload = {
        params: {
          id: MOCK_SELLER_CATEGORY_ID_1,
        },
        body: {
          commissionRate: 4.25,
        },
      };

      const result = updateSellerCategoryCommissionSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.commissionRate).toBe(4.25);
      }
    });

    it("should reject commission rate override with negative value or exceeding 100%", () => {
      const negativePayload = {
        params: { id: MOCK_SELLER_CATEGORY_ID_1 },
        body: { commissionRate: -1 },
      };
      expect(updateSellerCategoryCommissionSchema.safeParse(negativePayload).success).toBe(false);

      const excessivePayload = {
        params: { id: MOCK_SELLER_CATEGORY_ID_1 },
        body: { commissionRate: 101 },
      };
      expect(updateSellerCategoryCommissionSchema.safeParse(excessivePayload).success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Seller Category Query Validation
  // =========================================================================
  describe("Query Seller Categories Validation", () => {
    it("should parse query parameters including active and approved filter and pagination", () => {
      const query = {
        query: {
          marketplaceType: "HOME_DECOR" as const,
          isApproved: "true",
          isActive: "true",
          page: "2",
          limit: "15",
        },
      };

      const result = getSellerCategoriesQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.marketplaceType).toBe("HOME_DECOR");
        expect(result.data.query.isApproved).toBe(true);
        expect(result.data.query.isActive).toBe(true);
        expect(result.data.query.page).toBe(2);
        expect(result.data.query.limit).toBe(15);
      }
    });
  });
});
