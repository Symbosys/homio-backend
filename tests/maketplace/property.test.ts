import { describe, it, expect } from "bun:test";
import {
  createPropertySchema,
  updatePropertySchema,
  updatePropertyVerificationSchema,
  getPropertiesQuerySchema,
  propertyIdParamSchema,
} from "../../src/module/marketplace/validators/property.validator.js";
import {
  MOCK_CATEGORY_PROPERTY_ID,
  MOCK_PROPERTY_LISTING_ID_1,
} from "./fixtures/marketplace.fixtures.js";

describe("Property Listings & Platform Verification Module Tests", () => {
  // =========================================================================
  // 1. Create Property Listing Validation
  // =========================================================================
  describe("Create Property Listing Validation", () => {
    it("should validate complete property listing payload with geo-coordinates and monetization fee", () => {
      const payload = {
        body: {
          categoryId: MOCK_CATEGORY_PROPERTY_ID,
          title: "Luxury 4BHK Sea-Facing Penthouse with Private Terrace",
          propertyType: "PENTHOUSE" as const,
          intent: "SALE" as const,
          bhk: "4 BHK",
          bedrooms: 4,
          bathrooms: 5,
          balconies: 3,
          carpetAreaSqft: 3800,
          superBuiltUpSqft: 4500,
          floorNumber: 24,
          totalFloors: 25,
          furnishingStatus: "Semi-Furnished",
          coveredParkingSlots: 3,
          locality: "Worli Sea Face",
          city: "Mumbai",
          state: "Maharashtra",
          pinCode: "400018",
          latitude: 19.0178,
          longitude: 72.8173,
          price: 185000000,
          maintenanceMonthly: 25000,
          isNegotiable: true,
          contactUnlockFee: 750,
          contactUnlockDurationDays: 60,
          ownerName: "Sunil Kapoor",
          ownerPhone: "+919820011223",
          ownerEmail: "sunil.kapoor@example.com",
          amenities: ["Private Elevator", "Sea View", "Infinity Pool", "Clubhouse", "24x7 Security"],
          description: "Exclusive penthouse with panoramic Arabian Sea views and Italian marble interiors",
          status: "PUBLISHED" as const,
          isFeatured: true,
        },
      };

      const result = createPropertySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toContain("Luxury 4BHK Sea-Facing Penthouse");
        expect(result.data.body.propertyType).toBe("PENTHOUSE");
        expect(result.data.body.carpetAreaSqft).toBe(3800);
        expect(result.data.body.latitude).toBe(19.0178);
        expect(result.data.body.contactUnlockFee).toBe(750);
      }
    });

    it("should reject property creation when required location or contact fields are missing", () => {
      const invalidPayload = {
        body: {
          title: "Incomplete Listing",
          bhk: "2 BHK",
        },
      };

      const result = createPropertySchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Platform Admin Verification Workflow Validation
  // =========================================================================
  describe("Platform Admin Verification Workflow Validation", () => {
    it("should validate verification status update to VERIFIED", () => {
      const payload = {
        params: {
          id: MOCK_PROPERTY_LISTING_ID_1,
        },
        body: {
          verificationStatus: "VERIFIED" as const,
        },
      };

      const result = updatePropertyVerificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.verificationStatus).toBe("VERIFIED");
      }
    });

    it("should validate verification status update to REJECTED or UNDER_REVIEW", () => {
      const payload = {
        params: {
          id: MOCK_PROPERTY_LISTING_ID_1,
        },
        body: {
          verificationStatus: "REJECTED" as const,
        },
      };

      const result = updatePropertyVerificationSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.verificationStatus).toBe("REJECTED");
      }
    });
  });

  // =========================================================================
  // 3. Query Property Listings Validation
  // =========================================================================
  describe("Query Property Listings Validation", () => {
    it("should validate query parameters with filters (city, locality, propertyType, price min/max)", () => {
      const query = {
        query: {
          city: "Mumbai",
          locality: "Worli",
          propertyType: "PENTHOUSE" as const,
          intent: "SALE" as const,
          verificationStatus: "VERIFIED" as const,
          minPrice: "50000000",
          maxPrice: "200000000",
          isFeatured: "true",
          page: "1",
          limit: "10",
        },
      };

      const result = getPropertiesQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.city).toBe("Mumbai");
        expect(result.data.query.verificationStatus).toBe("VERIFIED");
        expect(result.data.query.isFeatured).toBe(true);
      }
    });
  });
});
