import { describe, it, expect } from "bun:test";
import {
  createMaterialSchema,
  updateMaterialSchema,
  getMaterialsQuerySchema,
  materialIdParamSchema,
  createMaterialVendorOfferingSchema,
  updateMaterialVendorOfferingSchema,
  materialVendorParamSchema,
} from "../../src/module/marketplace/validators/material.validator.js";
import {
  MOCK_CATEGORY_MATERIALS_ID,
  MOCK_MATERIAL_ID_1,
  MOCK_VENDOR_ID_1,
  MOCK_MATERIAL_VENDOR_OFFERING_ID_1,
} from "./fixtures/marketplace.fixtures.js";

describe("Material Products & Multi-Vendor Offerings Module Tests", () => {
  // =========================================================================
  // 1. Create Material Product Validation
  // =========================================================================
  describe("Create Material Master Product Validation", () => {
    it("should validate raw material product with inline vendor supplier offerings", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_MATERIALS_ID,
          name: "UltraTech 53 Grade Ordinary Portland Cement",
          sku: "MAT-CEM-UT53",
          brandName: "UltraTech",
          materialType: "CEMENT",
          unitOfMeasure: "BAG" as const,
          wholesalePrice: 380,
          retailPrice: 420,
          minOrderQuantity: 50,
          stockAvailableUnits: 500,
          vendorOfferings: [
            {
              vendorId: MOCK_VENDOR_ID_1,
              commissionRate: 6.5,
              wholesalePrice: 360,
              retailPrice: 410,
              vendorSku: "APEX-UT-CEM",
              stockAvailableUnits: 300,
              minOrderQuantity: 100,
              leadTimeDays: 2,
              isPrimary: true,
              additionalInformation: {
                dispatchLocality: "Peenya Yard 1",
              },
            },
          ],
        },
      };

      const result = createMaterialSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("UltraTech 53 Grade Ordinary Portland Cement");
        expect(result.data.body.unitOfMeasure).toBe("BAG");
        expect(result.data.body.vendorOfferings).toHaveLength(1);
        expect(result.data.body.vendorOfferings?.[0]?.commissionRate).toBe(6.5);
        expect(result.data.body.vendorOfferings?.[0]?.leadTimeDays).toBe(2);
      }
    });

    it("should validate material creation without initial vendor offerings", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_MATERIALS_ID,
          name: "Tata Tiscon 550D TMT Rebars 12mm",
          sku: "MAT-STEEL-12MM",
          materialType: "STEEL",
          unitOfMeasure: "TON" as const,
          wholesalePrice: 62000,
          retailPrice: 65000,
        },
      };

      const result = createMaterialSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.unitOfMeasure).toBe("TON");
        expect(result.data.body.vendorOfferings).toHaveLength(0);
      }
    });
  });

  // =========================================================================
  // 2. Material Multi-Vendor Offering Sub-Routes Validation
  // =========================================================================
  describe("Material Vendor Offering Sub-Routes Validation", () => {
    it("should validate attaching a supplier offering to a material product", () => {
      const payload = {
        params: {
          productId: MOCK_MATERIAL_ID_1,
        },
        body: {
          vendorId: MOCK_VENDOR_ID_1,
          commissionRate: 5.5,
          wholesalePrice: 60500,
          retailPrice: 64500,
          vendorSku: "STEEL-APEX-TATA",
          stockAvailableUnits: 50,
          minOrderQuantity: 5,
          leadTimeDays: 3,
          isPrimary: true,
          additionalInformation: {
            loadingUnloadingIncluded: true,
          },
        },
      };

      const result = createMaterialVendorOfferingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.productId).toBe(MOCK_MATERIAL_ID_1);
        expect(result.data.body.commissionRate).toBe(5.5);
        expect(result.data.body.wholesalePrice).toBe(60500);
      }
    });

    it("should validate updating a material vendor offering", () => {
      const payload = {
        params: {
          productId: MOCK_MATERIAL_ID_1,
          vendorOfferingId: MOCK_MATERIAL_VENDOR_OFFERING_ID_1,
        },
        body: {
          wholesalePrice: 59800,
          commissionRate: 6.0,
          stockAvailableUnits: 80,
          leadTimeDays: 2,
        },
      };

      const result = updateMaterialVendorOfferingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.wholesalePrice).toBe(59800);
        expect(result.data.body.commissionRate).toBe(6.0);
        expect(result.data.body.stockAvailableUnits).toBe(80);
      }
    });

    it("should validate route parameters for material vendor routes", () => {
      const params = {
        params: {
          productId: MOCK_MATERIAL_ID_1,
          vendorOfferingId: MOCK_MATERIAL_VENDOR_OFFERING_ID_1,
        },
      };

      const result = materialVendorParamSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Query Material Products Validation
  // =========================================================================
  describe("Query Material Products Validation", () => {
    it("should validate query parameters for procurement catalog", () => {
      const query = {
        query: {
          categoryId: MOCK_CATEGORY_MATERIALS_ID,
          materialType: "CEMENT",
          unitOfMeasure: "BAG" as const,
          search: "UltraTech",
          page: "1",
          limit: "25",
        },
      };

      const result = getMaterialsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.unitOfMeasure).toBe("BAG");
        expect(result.data.query.materialType).toBe("CEMENT");
      }
    });
  });
});
