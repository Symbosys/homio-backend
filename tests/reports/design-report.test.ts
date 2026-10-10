import { describe, it, expect } from "bun:test";
import {
  getDesignReportsQuerySchema,
  DatePresetEnum,
  GroupByEnum,
} from "../../src/module/reports/validators/design-report.validator";

const MOCK_PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_EMPLOYEE_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_FOLDER_ID = "33333333-3333-4333-8333-333333333333";

describe("Design & DAM Reports Module Tests", () => {
  // =========================================================================
  // 1. Design Reports Query Validator Validation
  // =========================================================================
  describe("Design Reports Query Validator", () => {
    it("should parse an empty query with default this_month preset and day grouping", () => {
      const result = getDesignReportsQuerySchema.safeParse({ query: {} });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.datePreset).toBe("this_month");
        expect(result.data.query.groupBy).toBe("day");
      }
    });

    it("should accept valid date presets and project/employee filters", () => {
      const payload = {
        query: {
          projectId: MOCK_PROJECT_ID,
          employeeId: MOCK_EMPLOYEE_ID,
          folderId: MOCK_FOLDER_ID,
          datePreset: "last_3_months" as const,
          groupBy: "week" as const,
          stage: "GOOD_FOR_CONSTRUCTION_GFC" as const,
          status: "APPROVED" as const,
        },
      };

      const result = getDesignReportsQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.projectId).toBe(MOCK_PROJECT_ID);
        expect(result.data.query.employeeId).toBe(MOCK_EMPLOYEE_ID);
        expect(result.data.query.folderId).toBe(MOCK_FOLDER_ID);
        expect(result.data.query.datePreset).toBe("last_3_months");
        expect(result.data.query.groupBy).toBe("week");
      }
    });

    it("should accept custom date ranges with YYYY-MM-DD strings", () => {
      const payload = {
        query: {
          datePreset: "custom" as const,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      };

      const result = getDesignReportsQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.startDate).toBe("2026-01-01");
        expect(result.data.query.endDate).toBe("2026-12-31");
      }
    });

    it("should accept ISO 8601 datetime strings", () => {
      const payload = {
        query: {
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-31T23:59:59.999Z",
        },
      };

      const result = getDesignReportsQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject invalid project UUID formats", () => {
      const payload = {
        query: {
          projectId: "invalid-uuid-token",
        },
      };

      const result = getDesignReportsQuerySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid employee UUID formats", () => {
      const payload = {
        query: {
          employeeId: "not-a-valid-uuid",
        },
      };

      const result = getDesignReportsQuerySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should validate all available date presets", () => {
      const presets = [
        "today",
        "yesterday",
        "this_week",
        "last_week",
        "this_month",
        "last_month",
        "last_3_months",
        "last_6_months",
        "this_year",
        "all_time",
        "custom",
      ] as const;

      for (const preset of presets) {
        const result = DatePresetEnum.safeParse(preset);
        expect(result.success).toBe(true);
      }
    });

    it("should reject unlisted date presets", () => {
      const result = DatePresetEnum.safeParse("next_century");
      expect(result.success).toBe(false);
    });
  });
});
