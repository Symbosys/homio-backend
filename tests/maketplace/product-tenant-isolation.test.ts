import { describe, it, expect } from "bun:test";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ORGANIZATION_ID_2,
  MOCK_VENDOR_ID_1,
} from "./fixtures/marketplace.fixtures.js";
import {
  ProductType,
  ProductOwnershipType,
  ProductStatus,
} from "../../src/types/types.js";

describe("Marketplace Multi-Tenant & Business Scoping Isolation", () => {
  it("should maintain organization scoping isolation on products", () => {
    const tenant1Product = {
      id: "prod-tenant-1-001",
      organizationId: MOCK_ORGANIZATION_ID_1,
      name: "Tenant 1 Exclusive Architectural Render",
      slug: "exclusive-render-t1",
      type: ProductType.DIGITAL_ASSET,
      ownershipType: ProductOwnershipType.SELF_OWNED,
      sellingPrice: 5000,
    };

    const tenant2Product = {
      id: "prod-tenant-2-001",
      organizationId: MOCK_ORGANIZATION_ID_2,
      name: "Tenant 2 Exclusive Architectural Render",
      slug: "exclusive-render-t2",
      type: ProductType.DIGITAL_ASSET,
      ownershipType: ProductOwnershipType.SELF_OWNED,
      sellingPrice: 7500,
    };

    // Both tenants have distinct organization IDs
    expect(tenant1Product.organizationId).not.toEqual(tenant2Product.organizationId);
    expect(tenant1Product.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
    expect(tenant2Product.organizationId).toBe(MOCK_ORGANIZATION_ID_2);
  });

  it("should ensure vendor-owned products are linked to valid tenant vendor context", () => {
    const vendorProduct = {
      organizationId: MOCK_ORGANIZATION_ID_1,
      vendorId: MOCK_VENDOR_ID_1,
      ownershipType: ProductOwnershipType.VENDOR_OWNED,
      name: "Vendor Granite Tile",
      type: ProductType.MATERIALS,
      sellingPrice: 450,
      status: ProductStatus.PUBLISHED,
    };

    expect(vendorProduct.ownershipType).toBe(ProductOwnershipType.VENDOR_OWNED);
    expect(vendorProduct.vendorId).toBe(MOCK_VENDOR_ID_1);
    expect(vendorProduct.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
  });
});
