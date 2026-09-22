import { describe, it, expect } from "bun:test";
import {
  createVendorSchema,
  updateVendorSchema,
  getVendorsQuerySchema,
  vendorIdParamSchema,
} from "../../src/module/marketplace/validators/vendor.validator.js";
import { MOCK_VENDOR_ID_1 } from "./fixtures/marketplace.fixtures.js";

describe("Vendor Module Tests", () => {
  // =========================================================================
  // 1. Create Vendor Validation
  // =========================================================================
  describe("Create Vendor Validation", () => {
    it("should validate complete vendor creation payload with contact and tax details", () => {
      const payload = {
        body: {
          name: "Apex Tiles & Ceramics Pvt Ltd",
          code: "VEND-APEX-01",
          contactPerson: "Rajesh Singhania",
          email: "rajesh@apextiles.com",
          phone: "+919876543210",
          address: "Plot 42, Industrial Area, Peenya",
          city: "Bangalore",
          state: "Karnataka",
          pincode: "560058",
          gstin: "29ABCDE1234F1Z5",
          defaultCommissionRate: 12.5,
          isActive: true,
        },
      };

      const result = createVendorSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe("Apex Tiles & Ceramics Pvt Ltd");
        expect(result.data.body.code).toBe("VEND-APEX-01");
        expect(result.data.body.defaultCommissionRate).toBe(12.5);
        expect(result.data.body.city).toBe("Bangalore");
        expect(result.data.body.isActive).toBe(true);
      }
    });

    it("should reject vendor creation when name is missing", () => {
      const invalidPayload = {
        body: {
          contactPerson: "Rajesh",
        },
      };

      const result = createVendorSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid defaultCommissionRate bounds", () => {
      const payload = {
        body: {
          name: "Delta Fittings",
          defaultCommissionRate: -5,
        },
      };

      const result = createVendorSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Update Vendor Validation
  // =========================================================================
  describe("Update Vendor Validation", () => {
    it("should allow partial (dirty payload) updates to vendor contact and commission", () => {
      const payload = {
        params: {
          id: MOCK_VENDOR_ID_1,
        },
        body: {
          defaultCommissionRate: 15.0,
          contactPerson: "Suresh Singhania",
          isActive: true,
        },
      };

      const result = updateVendorSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.defaultCommissionRate).toBe(15.0);
        expect(result.data.body.contactPerson).toBe("Suresh Singhania");
        expect(result.data.body.isActive).toBe(true);
      }
    });
  });

  // =========================================================================
  // 3. Query Vendors Validation
  // =========================================================================
  describe("Query Vendors Validation", () => {
    it("should validate vendor query parameters with filters", () => {
      const query = {
        query: {
          isActive: "true",
          search: "Apex",
          page: "1",
          limit: "10",
        },
      };

      const result = getVendorsQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.isActive).toBe(true);
        expect(result.data.query.search).toBe("Apex");
      }
    });
  });
});
