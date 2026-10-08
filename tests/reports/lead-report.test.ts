import { describe, it, expect } from "bun:test";
import {
  getEmployeePerformanceQuerySchema,
  getTopPerformersQuerySchema,
} from "../../src/module/reports/validators/lead-report.validator";

const MOCK_EMPLOYEE_ID_1 = "11111111-1111-4111-8111-111111111111";
const MOCK_EMPLOYEE_ID_2 = "22222222-2222-4222-8222-222222222222";
const MOCK_DEPARTMENT_ID = "33333333-3333-4333-8333-333333333333";

describe("Lead Reports Module Tests", () => {
  // =========================================================================
  // 1. Employee Performance Query Validation
  // =========================================================================
  describe("Employee Performance Query Validation", () => {
    it("should parse an empty query with default month grouping", () => {
      const result = getEmployeePerformanceQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.groupBy).toBe("month");
      }
    });

    it("should accept valid date ranges with employee and department filters", () => {
      const payload = {
        query: {
          employeeId: MOCK_EMPLOYEE_ID_1,
          departmentId: MOCK_DEPARTMENT_ID,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          groupBy: "week" as const,
          status: "WON" as const,
          source: "META_ADS" as const,
          projectType: "RESIDENTIAL" as const,
          priority: "HIGH" as const,
        },
      };

      const result = getEmployeePerformanceQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.employeeId).toBe(MOCK_EMPLOYEE_ID_1);
        expect(result.data.query.departmentId).toBe(MOCK_DEPARTMENT_ID);
        expect(result.data.query.groupBy).toBe("week");
        expect(result.data.query.status).toBe("WON");
        expect(result.data.query.source).toBe("META_ADS");
      }
    });

    it("should accept ISO datetime strings for fromDate and toDate", () => {
      const payload = {
        query: {
          fromDate: "2026-03-01T00:00:00.000Z",
          toDate: "2026-03-31T23:59:59.999Z",
          groupBy: "day" as const,
        },
      };

      const result = getEmployeePerformanceQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject invalid employee UUID formats", () => {
      const payload = {
        query: {
          employeeId: "not-a-valid-uuid",
        },
      };

      const result = getEmployeePerformanceQuerySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid time grouping values", () => {
      const payload = {
        query: {
          groupBy: "decade",
        },
      };

      const result = getEmployeePerformanceQuerySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 2. Top Performers Query Validation
  // =========================================================================
  describe("Top Performers Query Validation", () => {
    it("should parse empty query with default limit (10) and metric ('conversions')", () => {
      const result = getTopPerformersQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(10);
        expect(result.data.query.metric).toBe("conversions");
      }
    });

    it("should support conversion_rate, revenue, and leads_handled metrics", () => {
      const metrics = ["conversions", "conversion_rate", "revenue", "leads_handled"] as const;

      metrics.forEach((metric) => {
        const result = getTopPerformersQuerySchema.safeParse({
          query: { metric },
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.query.metric).toBe(metric);
        }
      });
    });

    it("should coerce string limits into numbers and enforce limits between 1 and 50", () => {
      const validLimit = getTopPerformersQuerySchema.safeParse({
        query: { limit: "25" as any },
      });
      expect(validLimit.success).toBe(true);
      if (validLimit.success) {
        expect(validLimit.data.query.limit).toBe(25);
      }

      const zeroLimit = getTopPerformersQuerySchema.safeParse({
        query: { limit: 0 },
      });
      expect(zeroLimit.success).toBe(false);

      const excessiveLimit = getTopPerformersQuerySchema.safeParse({
        query: { limit: 100 },
      });
      expect(excessiveLimit.success).toBe(false);
    });

    it("should reject unsupported metric types", () => {
      const result = getTopPerformersQuerySchema.safeParse({
        query: { metric: "unknown_score" },
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Lead Conversion Rate Calculation Logic
  // =========================================================================
  describe("Lead Conversion Rate Calculation Logic", () => {
    it("should accurately calculate conversion percentage", () => {
      const computeConversionRate = (converted: number, total: number) => {
        return total > 0 ? Math.round((converted / total) * 10000) / 100 : 0;
      };

      expect(computeConversionRate(0, 0)).toBe(0);
      expect(computeConversionRate(5, 20)).toBe(25);
      expect(computeConversionRate(1, 3)).toBe(33.33);
      expect(computeConversionRate(2, 3)).toBe(66.67);
      expect(computeConversionRate(10, 10)).toBe(100);
    });

    it("should correctly rank performers based on score descending", () => {
      const performers = [
        { employeeId: MOCK_EMPLOYEE_ID_1, name: "Alice", convertedCount: 15, score: 15 },
        { employeeId: MOCK_EMPLOYEE_ID_2, name: "Bob", convertedCount: 22, score: 22 },
      ];

      performers.sort((a, b) => b.score - a.score);

      expect(performers[0]!.name).toBe("Bob");
      expect(performers[0]!.score).toBe(22);
      expect(performers[1]!.name).toBe("Alice");
      expect(performers[1]!.score).toBe(15);
    });
  });
});
