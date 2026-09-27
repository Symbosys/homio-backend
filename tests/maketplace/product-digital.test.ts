import { describe, it, expect } from "bun:test";
import {
  createProductSchema,
  digitalProductDetailsSchema,
} from "../../src/module/marketplace/validators/product.validator.js";
import {
  ProductType,
  ProductStatus,
  ProductOwnershipType,
} from "../../src/types/types.js";

describe("Marketplace Unified Product - Digital Asset Type", () => {
  const validDigitalPayload = {
    name: "Luxury Villa 3D BIM & Revit Model",
    type: ProductType.DIGITAL_ASSET,
    ownershipType: ProductOwnershipType.SELF_OWNED,
    sellingPrice: 4999,
    mrp: 7999,
    unit: "license",
    digitalDetails: {
      fileUrl: "https://storage.homio.in/assets/bim-models/luxury-villa-revit-2024.zip",
      fileFormat: "RVT / IFC / OBJ",
      fileSize: "148.5 MB",
      authorName: "Homio Design Labs",
      version: "2.1.0",
      compatibleSoftware: "Autodesk Revit 2023+, AutoCAD 2024, SketchUp 2023",
      licenseType: "Single Commercial Project License",
      downloadLinkExpiryHours: 72,
      maxDownloads: 10,
    },
  };

  it("should successfully validate a complete digital asset product payload", () => {
    const result = createProductSchema.safeParse({ body: validDigitalPayload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.type).toBe(ProductType.DIGITAL_ASSET);
      expect(result.data.body.digitalDetails?.fileFormat).toBe("RVT / IFC / OBJ");
      expect(result.data.body.digitalDetails?.downloadLinkExpiryHours).toBe(72);
      expect(result.data.body.digitalDetails?.maxDownloads).toBe(10);
    }
  });

  it("should fail validation if fileUrl is missing in digitalDetails", () => {
    const invalidPayload = {
      ...validDigitalPayload,
      digitalDetails: {
        fileFormat: "RVT",
        // missing fileUrl
      },
    };
    const result = createProductSchema.safeParse({ body: invalidPayload });
    expect(result.success).toBe(false);
  });

  it("should fail validation if fileFormat is missing in digitalDetails", () => {
    const invalidPayload = {
      ...validDigitalPayload,
      digitalDetails: {
        fileUrl: "https://storage.homio.in/asset.zip",
        // missing fileFormat
      },
    };
    const result = createProductSchema.safeParse({ body: invalidPayload });
    expect(result.success).toBe(false);
  });

  it("should apply default downloadLinkExpiryHours (48) and maxDownloads (5) if omitted", () => {
    const minimalDigital = {
      fileUrl: "https://storage.homio.in/drawings/sample.pdf",
      fileFormat: "PDF",
    };
    const result = digitalProductDetailsSchema.safeParse(minimalDigital);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.downloadLinkExpiryHours).toBe(48);
      expect(result.data.maxDownloads).toBe(5);
      expect(result.data.version).toBe("1.0.0");
    }
  });
});
