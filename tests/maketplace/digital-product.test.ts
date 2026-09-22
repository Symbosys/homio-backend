import { describe, it, expect } from "bun:test";
import {
  createDigitalProductSchema,
  updateDigitalProductSchema,
  getDigitalProductsQuerySchema,
  digitalProductIdParamSchema,
} from "../../src/module/marketplace/validators/digital-product.validator.js";
import {
  MOCK_CATEGORY_DIGITAL_ID,
  MOCK_DIGITAL_PRODUCT_ID_1,
} from "./fixtures/marketplace.fixtures.js";

describe("Digital Products Module Tests", () => {
  // =========================================================================
  // 1. Create Digital Product Validation
  // =========================================================================
  describe("Create Digital Product Validation", () => {
    it("should validate digital product creation payload (e.g. 3D Model / CAD asset)", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_DIGITAL_ID,
          name: "Modern Kitchen Revit Family & CAD Blocks Pack",
          sku: "DIGI-RVT-KITCHEN",
          description: "High-LOD Revit families, DWG blocks, and 3D Max models for luxury kitchens",
          authorName: "Homio Design Lab",
          fileFormat: "RVT" as const,
          fileSize: "145 MB",
          fileUrl: "https://storage.homio.in/digital/kitchen-pack.zip",
          downloadLinkExpiryHours: 72,
          maxDownloads: 10,
          mrp: 4999,
          sellingPrice: 2999,
          status: "PUBLISHED" as const,
          isFeatured: true,
          tags: ["Revit", "CAD", "Kitchen", "Interior"],
        },
      };

      const result = createDigitalProductSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Modern Kitchen Revit Family & CAD Blocks Pack");
        expect(result.data.body.fileFormat).toBe("RVT");
        expect(result.data.body.sellingPrice).toBe(2999);
        expect(result.data.body.downloadLinkExpiryHours).toBe(72);
      }
    });

    it("should reject digital product creation when name or categoryId is missing", () => {
      const invalidPayload = {
        body: {
          sku: "DIGI-FAIL-01",
        },
      };

      const result = createDigitalProductSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Update Digital Product Validation
  // =========================================================================
  describe("Update Digital Product Validation", () => {
    it("should allow partial (dirty payload) updates to price and download limits", () => {
      const payload = {
        params: {
          id: MOCK_DIGITAL_PRODUCT_ID_1,
        },
        body: {
          sellingPrice: 1999,
          maxDownloads: 15,
          status: "PUBLISHED" as const,
        },
      };

      const result = updateDigitalProductSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.sellingPrice).toBe(1999);
        expect(result.data.body.maxDownloads).toBe(15);
      }
    });
  });

  // =========================================================================
  // 3. Query Digital Products Validation
  // =========================================================================
  describe("Query Digital Products Validation", () => {
    it("should validate digital product query with search, status and feature filters", () => {
      const query = {
        query: {
          categoryId: MOCK_CATEGORY_DIGITAL_ID,
          status: "PUBLISHED" as const,
          search: "Kitchen",
          isFeatured: "true",
          page: "1",
          limit: "20",
        },
      };

      const result = getDigitalProductsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.status).toBe("PUBLISHED");
        expect(result.data.query.search).toBe("Kitchen");
        expect(result.data.query.isFeatured).toBe(true);
      }
    });
  });
});
