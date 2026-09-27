import { describe, it, expect } from "bun:test";
import {
  createProductSchema,
  materialProductDetailsSchema,
} from "../../src/module/marketplace/validators/product.validator.js";
import {
  ProductType,
  ProductOwnershipType,
} from "../../src/types/types.js";

describe("Marketplace Unified Product - Wholesale Material Type", () => {
  const validMaterialPayload = {
    name: "Italian Statuario Marble Slabs 20mm Grade-A",
    type: ProductType.MATERIALS,
    ownershipType: ProductOwnershipType.VENDOR_OWNED,
    vendorId: "12121212-1212-4212-8212-121212121212",
    mrp: 850,
    sellingPrice: 720,
    unit: "Sq.Ft.",
    stockQuantity: 5000,
    minOrderQuantity: 200,
    lowStockAlert: 500,
    materialDetails: {
      brandName: "Carrara Natural Stones",
      materialType: "Imported Italian Marble",
      grade: "Export Grade A+",
      dimensions: "8ft x 5ft Slab",
      thickness: "20 mm (+/- 0.5mm)",
      application: "Flooring, Wall Cladding, Countertops, Bathroom Vanities",
      coveragePerUnit: "1 Sq.Ft.",
      warrantyYears: 10,
      technicalDocUrl: "https://storage.homio.in/specs/statuario-marble-tds.pdf",
      leadTimeDays: 14,
    },
  };

  it("should successfully validate a complete material product payload", () => {
    const result = createProductSchema.safeParse({ body: validMaterialPayload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.type).toBe(ProductType.MATERIALS);
      expect(result.data.body.unit).toBe("Sq.Ft.");
      expect(result.data.body.minOrderQuantity).toBe(200);
      expect(result.data.body.materialDetails?.thickness).toBe("20 mm (+/- 0.5mm)");
      expect(result.data.body.materialDetails?.warrantyYears).toBe(10);
      expect(result.data.body.materialDetails?.leadTimeDays).toBe(14);
    }
  });

  it("should validate minimal material details and apply default warranty and lead time", () => {
    const minimalMaterial = {
      materialType: "AAC Blocks 6 Inch",
    };
    const result = materialProductDetailsSchema.safeParse(minimalMaterial);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.warrantyYears).toBe(0);
      expect(result.data.leadTimeDays).toBe(7);
    }
  });
});
