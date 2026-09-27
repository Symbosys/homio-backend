import { describe, it, expect } from "bun:test";
import {
  createProductSchema,
  homeDecorProductDetailsSchema,
} from "../../src/module/marketplace/validators/product.validator.js";
import {
  ProductType,
  ProductOwnershipType,
} from "../../src/types/types.js";

describe("Marketplace Unified Product - Home Decor Type", () => {
  const validDecorPayload = {
    name: "Handcrafted Teak Wood Dining Chair",
    type: ProductType.HOME_DECOR,
    ownershipType: ProductOwnershipType.VENDOR_OWNED,
    vendorId: "12121212-1212-4212-8212-121212121212",
    mrp: 14500,
    sellingPrice: 11900,
    unit: "piece",
    stockQuantity: 24,
    homeDecorDetails: {
      brandName: "Royal Heritage Woodcraft",
      material: "Burma Teak & Brass Fittings",
      color: "Warm Walnut / Matte Brass",
      dimensions: "L: 55cm x W: 52cm x H: 88cm",
      roomType: "Dining Room",
      style: "Mid-Century Modern",
      assemblyRequired: false,
      careInstructions: "Wipe with a clean damp cloth. Avoid harsh chemical cleaners.",
      sampleAvailable: true,
      samplePrice: 499,
      leadTimeDays: 7,
    },
  };

  it("should successfully validate a complete home decor product payload", () => {
    const result = createProductSchema.safeParse({ body: validDecorPayload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.type).toBe(ProductType.HOME_DECOR);
      expect(result.data.body.homeDecorDetails?.material).toBe("Burma Teak & Brass Fittings");
      expect(result.data.body.homeDecorDetails?.sampleAvailable).toBe(true);
      expect(result.data.body.homeDecorDetails?.samplePrice).toBe(499);
      expect(result.data.body.homeDecorDetails?.leadTimeDays).toBe(7);
    }
  });

  it("should accept home decor without sample pricing and default to samplePrice 0", () => {
    const minimalDecor = {
      material: "Solid Oak Wood",
      roomType: "Living Room",
    };
    const result = homeDecorProductDetailsSchema.safeParse(minimalDecor);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sampleAvailable).toBe(false);
      expect(result.data.samplePrice).toBe(0);
      expect(result.data.leadTimeDays).toBe(5);
    }
  });

  it("should fail validation if negative values are passed for samplePrice", () => {
    const result = homeDecorProductDetailsSchema.safeParse({
      samplePrice: -100,
    });
    expect(result.success).toBe(false);
  });
});
