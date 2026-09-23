import { describe, it, expect } from "bun:test";
import {
  createServiceCategorySchema,
  updateServiceCategorySchema,
  getServiceCategoriesQuerySchema,
  serviceCategoryIdParamSchema,
} from "../../src/module/master-data/validators/service-category.validator.js";

describe("Master Data: Service Category Tests", () => {
  const MOCK_CATEGORY_ID = "c0000000-0000-4000-8000-000000000003";

  describe("Create Service Category Validation", () => {
    it("should validate full service category payload with SLA and additionalInformation", () => {
      const payload = {
        name: "Modular Kitchen & Wardrobes",
        slug: "modular-kitchen-wardrobes",
        code: "SRV-KIT-01",
        description: "Custom modular kitchens, acrylic shutters, quartz countertops, and carcass units.",
        icon: "Home",
        color: "#3B82F6",
        defaultSlaHours: 48,
        isDefault: true,
        isActive: true,
        sortOrder: 1,
        additionalInformation: {
          standardWarrantyYears: 10,
          hardwarePartner: "Hettich",
        },
      };

      const parsed = createServiceCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Modular Kitchen & Wardrobes");
      expect(parsed.body.defaultSlaHours).toBe(48);
      expect(parsed.body.color).toBe("#3B82F6");
      expect(parsed.body.additionalInformation).toEqual({
        standardWarrantyYears: 10,
        hardwarePartner: "Hettich",
      });
    });

    it("should allow minimal service category payload", () => {
      const payload = {
        name: "Full Turnkey Interior",
      };

      const parsed = createServiceCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Full Turnkey Interior");
      expect(parsed.body.defaultSlaHours).toBe(48);
      expect(parsed.body.isActive).toBe(true);
    });

    it("should reject creation when name is empty", () => {
      const payload = {
        name: "",
      };

      expect(() => createServiceCategorySchema.parse({ body: payload })).toThrow();
    });
  });

  describe("Update Service Category Validation", () => {
    it("should validate partial updates", () => {
      const payload = {
        defaultSlaHours: 72,
        color: "#2563EB",
        additionalInformation: { updated: true },
      };

      const parsed = updateServiceCategorySchema.parse({
        params: { id: MOCK_CATEGORY_ID },
        body: payload,
      });

      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
      expect(parsed.body.defaultSlaHours).toBe(72);
      expect(parsed.body.color).toBe("#2563EB");
    });
  });

  describe("Query Parameters Validation", () => {
    it("should parse query with search and pagination", () => {
      const query = {
        page: "1",
        limit: "10",
        search: "kitchen",
      };

      const parsed = getServiceCategoriesQuerySchema.parse({ query });
      expect(parsed.query.search).toBe("kitchen");
      expect(parsed.query.limit).toBe(10);
    });
  });

  describe("Param ID Validation", () => {
    it("should accept valid UUID", () => {
      const parsed = serviceCategoryIdParamSchema.parse({ params: { id: MOCK_CATEGORY_ID } });
      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
    });
  });
});
