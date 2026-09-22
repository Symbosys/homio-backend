import { describe, it, expect } from "bun:test";
import {
  projectAnalyticsParamSchema,
  getAnalyticsOverviewQuerySchema,
} from "../../src/module/after-sales/validators/analytics.validator.js";

describe("After-Sales: Analytics & KPI Tests", () => {
  const MOCK_PROJECT_ID = "11112222-3333-4444-8555-666677778888";

  describe("Analytics Validation", () => {
    it("should validate project ID param for project-specific analytics", () => {
      const parsed = projectAnalyticsParamSchema.parse({ projectId: MOCK_PROJECT_ID });
      expect(parsed.projectId).toBe(MOCK_PROJECT_ID);

      expect(() => projectAnalyticsParamSchema.parse({ projectId: "invalid-uuid" })).toThrow();
    });

    it("should validate overview query date filters", () => {
      const query = {
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      };

      const parsed = getAnalyticsOverviewQuerySchema.parse(query);
      expect(parsed.startDate).toBe("2026-01-01");
      expect(parsed.endDate).toBe("2026-12-31");
    });
  });
});
