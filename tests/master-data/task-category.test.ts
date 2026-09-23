import { describe, it, expect } from "bun:test";
import {
  createTaskCategorySchema,
  updateTaskCategorySchema,
  getTaskCategoriesQuerySchema,
  taskCategoryIdParamSchema,
} from "../../src/module/master-data/validators/task-category.validator.js";

describe("Master Data: Task Category Tests", () => {
  const MOCK_CATEGORY_ID = "55556666-7777-8888-9999-000011112222";

  describe("Create Task Category Validation", () => {
    it("should validate full task category payload with scope, priority, and additionalInformation", () => {
      const payload = {
        name: "Site Measurement & Survey",
        slug: "site-measurement-survey",
        code: "TSK-SURVEY-01",
        scope: "LEAD" as const,
        description: "On-site 3D laser scan and dimension verification before CAD drafting.",
        color: "#8B5CF6",
        icon: "Ruler",
        defaultPriority: "HIGH" as const,
        defaultEstimatedHours: 4,
        isDefault: false,
        isActive: true,
        sortOrder: 1,
        additionalInformation: {
          equipmentRequired: ["Leica Disto", "Measuring Tape", "Site Pad"],
        },
      };

      const parsed = createTaskCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Site Measurement & Survey");
      expect(parsed.body.scope).toBe("LEAD");
      expect(parsed.body.defaultPriority).toBe("HIGH");
      expect(parsed.body.defaultEstimatedHours).toBe(4);
      expect(parsed.body.additionalInformation).toEqual({
        equipmentRequired: ["Leica Disto", "Measuring Tape", "Site Pad"],
      });
    });

    it("should allow minimal task category payload with default ALL scope and MEDIUM priority", () => {
      const payload = {
        name: "Client Follow-up",
      };

      const parsed = createTaskCategorySchema.parse({ body: payload });
      expect(parsed.body.name).toBe("Client Follow-up");
      expect(parsed.body.scope).toBe("ALL");
      expect(parsed.body.defaultPriority).toBe("MEDIUM");
      expect(parsed.body.isActive).toBe(true);
    });

    it("should reject creation with invalid scope", () => {
      const payload = {
        name: "Test Task Category",
        scope: "INVALID_TASK_SCOPE",
      };

      expect(() => createTaskCategorySchema.parse({ body: payload })).toThrow();
    });
  });

  describe("Update Task Category Validation", () => {
    it("should validate partial updates", () => {
      const payload = {
        defaultEstimatedHours: 2.5,
        defaultPriority: "URGENT" as const,
        additionalInformation: { milestoneTag: "Pre-Design" },
      };

      const parsed = updateTaskCategorySchema.parse({
        params: { id: MOCK_CATEGORY_ID },
        body: payload,
      });

      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
      expect(parsed.body.defaultEstimatedHours).toBe(2.5);
      expect(parsed.body.defaultPriority).toBe("URGENT");
      expect(parsed.body.additionalInformation).toEqual({ milestoneTag: "Pre-Design" });
    });
  });

  describe("Query Parameters Validation", () => {
    it("should parse query with scope filter", () => {
      const query = {
        page: "1",
        limit: "50",
        scope: "PROJECT",
        search: "drawing",
      };

      const parsed = getTaskCategoriesQuerySchema.parse({ query });
      expect(parsed.query.scope).toBe("PROJECT");
      expect(parsed.query.search).toBe("drawing");
    });
  });

  describe("Param ID Validation", () => {
    it("should accept valid UUID", () => {
      const parsed = taskCategoryIdParamSchema.parse({ params: { id: MOCK_CATEGORY_ID } });
      expect(parsed.params.id).toBe(MOCK_CATEGORY_ID);
    });
  });
});
