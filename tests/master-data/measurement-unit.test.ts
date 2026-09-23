import { describe, it, expect } from "bun:test";
import {
  createMeasurementUnitSchema,
  updateMeasurementUnitSchema,
  getMeasurementUnitsQuerySchema,
  measurementUnitIdParamSchema,
} from "../../src/module/master-data/validators/measurement-unit.validator.js";

describe("Master Data: Measurement Unit Tests", () => {
  const MOCK_UNIT_ID = "a0000000-0000-4000-8000-000000000001";

  describe("Create Measurement Unit Validation", () => {
    it("should validate full measurement unit payload with additionalInformation", () => {
      const payload = {
        name: "Square Feet",
        symbol: "sqft",
        code: "UOM-SQFT",
        type: "AREA" as const,
        description: "Standard area unit used for floor plans, tiling, and wall coverage.",
        precision: 2,
        conversionFactor: 0.092903,
        baseUnitSymbol: "sq.m",
        isDefault: true,
        isActive: true,
        sortOrder: 1,
        additionalInformation: {
          commonTrade: "Flooring & Civil",
          regulatoryBody: "IS 1200",
        },
      };

      const parsed = createMeasurementUnitSchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Square Feet");
      expect(parsed.body.symbol).toBe("sqft");
      expect(parsed.body.type).toBe("AREA");
      expect(parsed.body.precision).toBe(2);
      expect(parsed.body.conversionFactor).toBe(0.092903);
      expect(parsed.body.additionalInformation).toEqual({
        commonTrade: "Flooring & Civil",
        regulatoryBody: "IS 1200",
      });
    });

    it("should allow minimal measurement unit payload with sensible defaults", () => {
      const payload = {
        name: "Piece",
        symbol: "PCS",
      };

      const parsed = createMeasurementUnitSchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Piece");
      expect(parsed.body.symbol).toBe("PCS");
      expect(parsed.body.type).toBe("QUANTITY");
      expect(parsed.body.precision).toBe(2);
      expect(parsed.body.isActive).toBe(true);
      expect(parsed.body.sortOrder).toBe(0);
    });

    it("should reject creation when symbol is empty", () => {
      const payload = {
        name: "Running Feet",
        symbol: "",
      };

      expect(() => createMeasurementUnitSchema.parse({ body: payload })).toThrow();
    });

    it("should reject creation with invalid unit type", () => {
      const payload = {
        name: "Kilogram",
        symbol: "KG",
        type: "INVALID_TYPE",
      };

      expect(() => createMeasurementUnitSchema.parse({ body: payload })).toThrow();
    });
  });

  describe("Update Measurement Unit Validation", () => {
    it("should validate partial dirty updates including additionalInformation", () => {
      const payload = {
        symbol: "sq.ft.",
        precision: 3,
        additionalInformation: {
          updatedBy: "Admin",
        },
      };

      const parsed = updateMeasurementUnitSchema.parse({
        params: { id: MOCK_UNIT_ID },
        body: payload,
      });

      expect(parsed.params.id).toBe(MOCK_UNIT_ID);
      expect(parsed.body.symbol).toBe("sq.ft.");
      expect(parsed.body.precision).toBe(3);
      expect(parsed.body.name).toBeUndefined();
      expect(parsed.body.additionalInformation).toEqual({ updatedBy: "Admin" });
    });
  });

  describe("Query Parameters Validation", () => {
    it("should parse and transform string booleans in query", () => {
      const query = {
        page: "2",
        limit: "25",
        type: "AREA",
        isActive: "true",
        search: "sqft",
      };

      const parsed = getMeasurementUnitsQuerySchema.parse({ query });
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.type).toBe("AREA");
      expect(parsed.query.isActive).toBe(true);
      expect(parsed.query.search).toBe("sqft");
    });
  });

  describe("Param ID Validation", () => {
    it("should accept valid UUID", () => {
      const parsed = measurementUnitIdParamSchema.parse({ params: { id: MOCK_UNIT_ID } });
      expect(parsed.params.id).toBe(MOCK_UNIT_ID);
    });

    it("should reject malformed UUID", () => {
      expect(() => measurementUnitIdParamSchema.parse({ params: { id: "1234-invalid" } })).toThrow();
    });
  });
});
