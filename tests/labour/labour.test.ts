import { describe, it, expect } from "bun:test";
import {
  createLabourSchema,
  updateLabourSchema,
  getLaboursQuerySchema,
  labourIdParamSchema,
} from "../../src/module/labour/validators/labour.validator.js";
import { MOCK_IMAGE_OBJECT, MOCK_LABOUR_ID_1 } from "./fixtures/labour.fixtures.js";

describe("Labour Module - Core Profile Tests", () => {
  describe("1. Labour Creation Validation", () => {
    it("should validate full valid labour profile payload with rates, state, city and custom fields", () => {
      const payload = {
        body: {
          name: "Ramesh Kumar Carpenter",
          phone: "9876543210",
          altPhone: "9876543211",
          email: "ramesh.carpenter@example.com",
          photoUrl: MOCK_IMAGE_OBJECT,
          trade: "Carpentry",
          skillLevel: "Master",
          dailyRate: 1200.0,
          hourlyRate: 160.0,
          address: "No 45, 3rd Cross, Wilson Garden",
          state: "Karnataka",
          city: "Bengaluru",
          aadhaarNo: "XXXX-XXXX-8921",
          notes: "Expert in teakwood joinery and modular cabinets.",
          additionalInformation: {
            experienceYears: 12,
            hasOwnTools: true,
            vaccinationStatus: "DOUBLE_DOSED",
          },
        },
      };

      const parsed = createLabourSchema.parse(payload);
      expect(parsed.body.name).toBe("Ramesh Kumar Carpenter");
      expect(parsed.body.trade).toBe("Carpentry");
      expect(parsed.body.state).toBe("Karnataka");
      expect(parsed.body.city).toBe("Bengaluru");
      expect(parsed.body.dailyRate).toBe(1200.0);
      expect(parsed.body.additionalInformation?.experienceYears).toBe(12);
    });

    it("should reject creation when required fields (name, phone, trade, dailyRate) are missing", () => {
      const invalidPayload = {
        body: {
          email: "test@example.com",
        },
      };

      expect(() => createLabourSchema.parse(invalidPayload)).toThrow();
    });

    it("should reject negative or zero wage rates", () => {
      const negativeRatePayload = {
        body: {
          name: "Suresh Mason",
          phone: "9876543210",
          trade: "Masonry",
          dailyRate: -500,
        },
      };

      expect(() => createLabourSchema.parse(negativeRatePayload)).toThrow();
    });
  });

  describe("2. Symmetric Full Editability Validation (Rule 19)", () => {
    it("should allow partial dirty updates across all creation fields including state and city", () => {
      const partialUpdate = {
        params: { id: MOCK_LABOUR_ID_1 },
        body: {
          dailyRate: 1400.0,
          skillLevel: "Specialist",
          state: "Maharashtra",
          city: "Mumbai",
          notes: "Promoted to lead carpenter.",
          additionalInformation: {
            promotedAt: "2026-09-24",
          },
        },
      };

      const parsed = updateLabourSchema.parse(partialUpdate);
      expect(parsed.body.dailyRate).toBe(1400.0);
      expect(parsed.body.skillLevel).toBe("Specialist");
      expect(parsed.body.state).toBe("Maharashtra");
      expect(parsed.body.city).toBe("Mumbai");
    });

    it("should validate ID param format", () => {
      expect(() =>
        labourIdParamSchema.parse({ params: { id: "invalid-uuid" } })
      ).toThrow();
      expect(
        labourIdParamSchema.parse({ params: { id: MOCK_LABOUR_ID_1 } }).params.id
      ).toBe(MOCK_LABOUR_ID_1);
    });
  });

  describe("3. Query & Pagination Filters Validation", () => {
    it("should parse valid pagination, state, city and trade/status query parameters", () => {
      const query = {
        query: {
          page: "2",
          limit: "25",
          trade: "Carpentry",
          state: "Karnataka",
          city: "Bengaluru",
          status: "AVAILABLE",
          search: "Ramesh",
        },
      };

      const parsed = getLaboursQuerySchema.parse(query);
      expect(parsed.query.page).toBe(2);
      expect(parsed.query.limit).toBe(25);
      expect(parsed.query.trade).toBe("Carpentry");
      expect(parsed.query.state).toBe("Karnataka");
      expect(parsed.query.city).toBe("Bengaluru");
      expect(parsed.query.search).toBe("Ramesh");
    });
  });
});
