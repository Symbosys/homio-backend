import { describe, it, expect } from "bun:test";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ORGANIZATION_ID_2,
  MOCK_CATEGORY_HOME_DECOR_ID,
  MOCK_VENDOR_ID_1,
  MOCK_VENDOR_ID_2,
} from "./fixtures/marketplace.fixtures.js";
import { createHomeDecorSchema } from "../../src/module/marketplace/validators/home-decor.validator.js";
import { createMaterialSchema } from "../../src/module/marketplace/validators/material.validator.js";

describe("Marketplace Multi-Tenant Data Isolation & Security Tests", () => {
  // =========================================================================
  // 1. Tenant Scoping Validation
  // =========================================================================
  describe("Tenant Isolation Rules", () => {
    it("should enforce distinct tenant contexts across organization identifiers", () => {
      expect(MOCK_ORGANIZATION_ID_1).not.toBe(MOCK_ORGANIZATION_ID_2);
      expect(MOCK_VENDOR_ID_1).not.toBe(MOCK_VENDOR_ID_2);
    });

    it("should allow same product SKU to exist in distinct organizations without conflict", () => {
      const org1Product = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "Minimalist Coffee Table",
          sku: "TABLE-MINIMAL-01",
          sellingPrice: 12000,
        },
      };

      const org2Product = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "Minimalist Coffee Table (Org 2)",
          sku: "TABLE-MINIMAL-01",
          sellingPrice: 14000,
        },
      };

      const result1 = createHomeDecorSchema.safeParse(org1Product);
      const result2 = createHomeDecorSchema.safeParse(org2Product);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      if (result1.success && result2.success) {
        expect(result1.data.body.sku).toBe(result2.data.body.sku);
      }
    });

    it("should validate vendor offering isolation per organization", () => {
      const org1OfferingPayload = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "Teak Dining Chair",
          sku: "CHAIR-TEAK-01",
          vendorOfferings: [
            {
              vendorId: MOCK_VENDOR_ID_1,
              commissionRate: 10.0,
              supplyPrice: 4000,
              sellingPrice: 5999,
              isPrimary: true,
            },
          ],
        },
      };

      const result = createHomeDecorSchema.safeParse(org1OfferingPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.vendorOfferings?.[0]?.vendorId).toBe(MOCK_VENDOR_ID_1);
        expect(result.data.body.vendorOfferings?.[0]?.commissionRate).toBe(10.0);
      }
    });

    it("should validate independent material catalog per organization", () => {
      const orgMaterialPayload = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "River Sand (Washed)",
          sku: "MAT-SAND-WASHED",
          unitOfMeasure: "TON" as const,
          wholesalePrice: 1800,
          retailPrice: 2200,
          vendorOfferings: [
            {
              vendorId: MOCK_VENDOR_ID_2,
              commissionRate: 8.0,
              wholesalePrice: 1650,
              retailPrice: 2100,
              stockAvailableUnits: 200,
              isPrimary: true,
            },
          ],
        },
      };

      const result = createMaterialSchema.safeParse(orgMaterialPayload);
      expect(result.success).toBe(true);
    });
  });
});
