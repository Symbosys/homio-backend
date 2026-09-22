import { describe, it, expect } from "bun:test";
import {
  createHomeDecorSchema,
  updateHomeDecorSchema,
  getHomeDecorQuerySchema,
  homeDecorIdParamSchema,
  createHomeDecorVendorOfferingSchema,
  updateHomeDecorVendorOfferingSchema,
  homeDecorVendorParamSchema,
} from "../../src/module/marketplace/validators/home-decor.validator.js";
import {
  MOCK_CATEGORY_HOME_DECOR_ID,
  MOCK_HOME_DECOR_ID_1,
  MOCK_VENDOR_ID_1,
  MOCK_VENDOR_ID_2,
  MOCK_HOME_DECOR_VENDOR_OFFERING_ID_1,
} from "./fixtures/marketplace.fixtures.js";

describe("Home Decor & Multi-Vendor Offerings Module Tests", () => {
  // =========================================================================
  // 1. Create Home Decor Product with Inline Vendor Offerings
  // =========================================================================
  describe("Create Home Decor Master Product Validation", () => {
    it("should validate product creation with inline vendor offerings and commission rates", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "Nordic Velvet 3-Seater Sofa",
          sku: "SOFA-NORDIC-001",
          brandName: "Urban Oak",
          description: "Ergonomic Scandinavian style velvet sofa with teak wood frame",
          ownershipType: "VENDOR_OWNED" as const,
          material: "Velvet & Solid Teak",
          color: "Emerald Green",
          dimensions: "210cm x 90cm x 85cm",
          roomType: "Living Room",
          mrp: 55000,
          sellingPrice: 42999,
          taxRate: 18,
          inStock: true,
          stockCount: 15,
          vendorOfferings: [
            {
              vendorId: MOCK_VENDOR_ID_1,
              commissionRate: 10.0,
              supplyPrice: 32000,
              sellingPrice: 42999,
              vendorSku: "APEX-SOFA-V1",
              stockCount: 10,
              inStock: true,
              leadTimeDays: 5,
              isPrimary: true,
              additionalInformation: {
                fabricWarrantyYears: 3,
              },
            },
            {
              vendorId: MOCK_VENDOR_ID_2,
              commissionRate: 12.5,
              supplyPrice: 31000,
              sellingPrice: 42999,
              vendorSku: "WOOD-SOFA-V2",
              stockCount: 5,
              inStock: true,
              leadTimeDays: 7,
              isPrimary: false,
            },
          ],
          additionalInformation: {
            assemblyRequired: false,
            warrantyPeriod: "5 Years Frame Warranty",
          },
        },
      };

      const result = createHomeDecorSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Nordic Velvet 3-Seater Sofa");
        expect(result.data.body.sku).toBe("SOFA-NORDIC-001");
        expect(result.data.body.vendorOfferings).toHaveLength(2);
        expect(result.data.body.vendorOfferings?.[0]?.commissionRate).toBe(10.0);
        expect(result.data.body.vendorOfferings?.[0]?.isPrimary).toBe(true);
        expect(result.data.body.vendorOfferings?.[1]?.commissionRate).toBe(12.5);
      }
    });

    it("should allow self-owned product creation without vendor offerings", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          name: "Custom Brass Table Lamp",
          sku: "LAMP-BRASS-01",
          ownershipType: "SELF_OWNED" as const,
          sellingPrice: 4999,
          inStock: true,
          stockCount: 25,
        },
      };

      const result = createHomeDecorSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.ownershipType).toBe("SELF_OWNED");
        expect(result.data.body.vendorOfferings).toHaveLength(0);
      }
    });
  });

  // =========================================================================
  // 2. Multi-Vendor Offering Sub-Routes Validation
  // =========================================================================
  describe("Add & Update Vendor Offering Sub-Routes Validation", () => {
    it("should validate attaching a new vendor offering to an existing product", () => {
      const payload = {
        params: {
          productId: MOCK_HOME_DECOR_ID_1,
        },
        body: {
          vendorId: MOCK_VENDOR_ID_1,
          commissionRate: 15.0,
          supplyPrice: 28000,
          sellingPrice: 39999,
          vendorSku: "SUPP-VEND-88",
          stockCount: 20,
          inStock: true,
          minOrderQuantity: 1,
          leadTimeDays: 4,
          isPrimary: true,
          additionalInformation: {
            directWarehouseDispatch: true,
          },
        },
      };

      const result = createHomeDecorVendorOfferingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.productId).toBe(MOCK_HOME_DECOR_ID_1);
        expect(result.data.body.vendorId).toBe(MOCK_VENDOR_ID_1);
        expect(result.data.body.commissionRate).toBe(15.0);
        expect(result.data.body.supplyPrice).toBe(28000);
        expect(result.data.body.additionalInformation?.directWarehouseDispatch).toBe(true);
      }
    });

    it("should validate updating a vendor offering with partial dirty payload", () => {
      const payload = {
        params: {
          productId: MOCK_HOME_DECOR_ID_1,
          vendorOfferingId: MOCK_HOME_DECOR_VENDOR_OFFERING_ID_1,
        },
        body: {
          commissionRate: 14.0,
          supplyPrice: 27500,
          stockCount: 35,
          isPrimary: true,
        },
      };

      const result = updateHomeDecorVendorOfferingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.vendorOfferingId).toBe(MOCK_HOME_DECOR_VENDOR_OFFERING_ID_1);
        expect(result.data.body.commissionRate).toBe(14.0);
        expect(result.data.body.supplyPrice).toBe(27500);
      }
    });

    it("should validate route parameters for primary switch and removal", () => {
      const params = {
        params: {
          productId: MOCK_HOME_DECOR_ID_1,
          vendorOfferingId: MOCK_HOME_DECOR_VENDOR_OFFERING_ID_1,
        },
      };

      const result = homeDecorVendorParamSchema.safeParse(params);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. Query Home Decor Products Validation
  // =========================================================================
  describe("Query Home Decor Products Validation", () => {
    it("should validate product query with filters (roomType, search, inStock)", () => {
      const query = {
        query: {
          categoryId: MOCK_CATEGORY_HOME_DECOR_ID,
          roomType: "Living Room",
          inStock: "true",
          search: "Nordic",
          page: "1",
          limit: "12",
        },
      };

      const result = getHomeDecorQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.roomType).toBe("Living Room");
        expect(result.data.query.inStock).toBe(true);
      }
    });
  });
});
