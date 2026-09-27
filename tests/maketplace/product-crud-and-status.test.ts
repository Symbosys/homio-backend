import { describe, it, expect } from "bun:test";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  updateProductStatusSchema,
} from "../../src/module/marketplace/validators/product.validator.js";
import {
  ProductType,
  ProductStatus,
  ProductOwnershipType,
} from "../../src/types/types.js";

describe("Marketplace Unified Product - Validation, Pricing, Filtering & Status", () => {
  it("should validate base product with custom additionalInformation JSON", () => {
    const payload = {
      name: "Custom Modular Kitchen Package",
      type: ProductType.HOME_DECOR,
      sellingPrice: 150000,
      mrp: 180000,
      additionalInformation: {
        customFinish: "Acrylic Matte",
        hardwareBrand: "Blum Soft-Close",
        installationIncluded: true,
      },
    };

    const result = createProductSchema.safeParse({ body: payload });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.additionalInformation).toEqual({
        customFinish: "Acrylic Matte",
        hardwareBrand: "Blum Soft-Close",
        installationIncluded: true,
      });
      expect(result.data.body.ownershipType).toBe(ProductOwnershipType.SELF_OWNED);
      expect(result.data.body.status).toBe(ProductStatus.DRAFT);
    }
  });

  it("should validate partial product updates (dirty payload)", () => {
    const updatePayload = {
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: {
        sellingPrice: 135000,
        inStock: false,
        stockQuantity: 0,
      },
    };

    const result = updateProductSchema.safeParse(updatePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.sellingPrice).toBe(135000);
      expect(result.data.body.inStock).toBe(false);
      expect(result.data.body.stockQuantity).toBe(0);
      expect(result.data.body.name).toBeUndefined();
    }
  });

  it("should validate product status lifecycle transitions", () => {
    const statusPayload = {
      params: { id: "11111111-1111-4111-8111-111111111111" },
      body: {
        status: ProductStatus.PUBLISHED,
      },
    };

    const result = updateProductStatusSchema.safeParse(statusPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.status).toBe(ProductStatus.PUBLISHED);
    }
  });

  it("should validate and parse catalog query filters with pagination defaults", () => {
    const queryPayload = {
      query: {
        type: ProductType.MATERIALS,
        status: ProductStatus.PUBLISHED,
        isFeatured: "true",
        minPrice: 100,
        maxPrice: 5000,
        page: "2",
        limit: "15",
        sortBy: "sellingPrice",
        sortOrder: "asc",
      },
    };

    const result = getProductsQuerySchema.safeParse(queryPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.type).toBe(ProductType.MATERIALS);
      expect(result.data.query.status).toBe(ProductStatus.PUBLISHED);
      expect(result.data.query.isFeatured).toBe(true);
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(15);
      expect(result.data.query.sortBy).toBe("sellingPrice");
      expect(result.data.query.sortOrder).toBe("asc");
    }
  });
});
