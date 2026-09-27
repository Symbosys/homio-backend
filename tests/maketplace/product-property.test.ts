import { describe, it, expect } from "bun:test";
import {
  createProductSchema,
  propertyListingDetailsSchema,
} from "../../src/module/marketplace/validators/product.validator.js";
import {
  ProductType,
  PropertyType,
  ListingIntent,
  PropertyVerificationStatus,
} from "../../src/types/types.js";

describe("Marketplace Unified Product - Property Listing Type", () => {
  const validPropertyPayload = {
    name: "Luxury 3 BHK Penthouse with Private Terrace",
    type: ProductType.PROPERTIES,
    sellingPrice: 18500000,
    mrp: 19500000,
    unit: "unit",
    propertyDetails: {
      propertyType: PropertyType.PENTHOUSE,
      intent: ListingIntent.SALE,
      verificationStatus: PropertyVerificationStatus.VERIFIED,
      bhk: "3 BHK",
      bedrooms: 3,
      bathrooms: 4,
      balconies: 2,
      carpetAreaSqft: 2450,
      superBuiltUpSqft: 2950,
      floorNumber: 18,
      totalFloors: 20,
      furnishingStatus: "Fully Furnished",
      coveredParkingSlots: 2,
      reraRegistration: "RERA-MH-2024-884920",
      maintenanceMonthly: 8500,
      isNegotiable: true,
      contactUnlockFee: 750,
      contactUnlockDurationDays: 45,
      ownerName: "Rajesh Singhania",
      ownerPhone: "+91 9876543210",
      ownerEmail: "rajesh.singhania@example.com",
      addressLine: "Tower 4, Flat 1802, Prestige Oceanview Heights",
      locality: "Worli Sea Face",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400018",
      latitude: 18.9986,
      longitude: 72.8154,
      amenities: ["Swimming Pool", "Gymnasium", "Clubhouse", "24/7 Security", "Private Elevator"],
    },
  };

  it("should successfully validate a complete property listing product payload", () => {
    const result = createProductSchema.safeParse({ body: validPropertyPayload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.type).toBe(ProductType.PROPERTIES);
      expect(result.data.body.propertyDetails?.propertyType).toBe(PropertyType.PENTHOUSE);
      expect(result.data.body.propertyDetails?.intent).toBe(ListingIntent.SALE);
      expect(result.data.body.propertyDetails?.carpetAreaSqft).toBe(2450);
      expect(result.data.body.propertyDetails?.locality).toBe("Worli Sea Face");
      expect(result.data.body.propertyDetails?.city).toBe("Mumbai");
      expect(result.data.body.propertyDetails?.amenities).toHaveLength(5);
    }
  });

  it("should fail validation if mandatory fields (bhk, carpetAreaSqft, ownerName, ownerPhone, city, locality) are missing", () => {
    const invalidProperty = {
      propertyType: PropertyType.APARTMENT,
      // missing bhk, carpetAreaSqft, ownerName, ownerPhone, locality, city
    };
    const result = propertyListingDetailsSchema.safeParse(invalidProperty);
    expect(result.success).toBe(false);
  });

  it("should default verificationStatus to DRAFT and intent to SALE", () => {
    const minimalProperty = {
      bhk: "2 BHK",
      bedrooms: 2,
      bathrooms: 2,
      carpetAreaSqft: 950,
      ownerName: "Amit Verma",
      ownerPhone: "9876500000",
      locality: "Whitefield",
      city: "Bengaluru",
      state: "Karnataka",
    };
    const result = propertyListingDetailsSchema.safeParse(minimalProperty);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.verificationStatus).toBe(PropertyVerificationStatus.DRAFT);
      expect(result.data.intent).toBe(ListingIntent.SALE);
      expect(result.data.contactUnlockFee).toBe(500);
      expect(result.data.contactUnlockDurationDays).toBe(30);
    }
  });
});
