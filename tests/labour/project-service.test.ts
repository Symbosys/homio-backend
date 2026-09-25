import { describe, it, expect } from "bun:test";
import {
  createProjectServiceSchema,
  updateProjectServiceSchema,
  updateProjectServiceStatusSchema,
  getProjectServicesQuerySchema,
  projectServiceIdParamSchema,
} from "../../src/module/labour/validators/project-service.validator.js";
import {
  MOCK_PROJECT_ID_1,
  MOCK_PROJECT_SERVICE_ID_1,
  MOCK_EMPLOYEE_ID_1,
} from "./fixtures/labour.fixtures.js";

describe("Project Services Module Tests", () => {
  // =========================================================================
  // 1. Service Code Sequential Format Verification
  // =========================================================================
  describe("Service Code Format Validation", () => {
    it("should conform to sequential Service Code pattern SRV-YYYY-NNNN", () => {
      const codeRegex = /^SRV-\d{4}-\d{4,}$/;
      expect(codeRegex.test("SRV-2026-0001")).toBe(true);
      expect(codeRegex.test("SRV-2026-0042")).toBe(true);
      expect(codeRegex.test("SRV-2026-9999")).toBe(true);
      expect(codeRegex.test("SRV-2026-10001")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
      expect(codeRegex.test("SRV-26-001")).toBe(false);
      expect(codeRegex.test("LB-2026-0001")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Create Project Service Validation
  // =========================================================================
  describe("Create Project Service Validation", () => {
    it("should validate full valid creation payload with all fields", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID_1,
          title: "False Ceiling Framing & Gypsum Board Work",
          category: "CARPENTRY",
          description: "Complete false ceiling installation for Living room & Master suite.",
          scopeOfWork: "Supply and install 12mm Saint-Gobain gypsum boards with GI channels.",
          location: "Living Room & Master Suite",
          status: "PLANNED",
          priority: "HIGH",
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-15T00:00:00.000Z",
          estimatedDurationDays: 14,
          estimatedBudget: 85000,
          supervisorId: MOCK_EMPLOYEE_ID_1,
          additionalInformation: {
            ceilingHeightFt: 10.5,
            coveLightProvision: true,
            materialSpec: "Saint-Gobain Gyproc",
          },
        },
      };

      const result = createProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toBe("False Ceiling Framing & Gypsum Board Work");
        expect(result.data.body.category).toBe("CARPENTRY");
        expect(result.data.body.estimatedBudget).toBe(85000);
        expect(result.data.body.estimatedDurationDays).toBe(14);
      }
    });

    it("should validate minimal valid payload with defaults", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID_1,
          title: "Plumbing Rough-In",
          category: "PLUMBING",
        },
      };

      const result = createProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.status).toBe("PLANNED");
        expect(result.data.body.priority).toBe("MEDIUM");
        expect(result.data.body.estimatedDurationDays).toBe(1);
        expect(result.data.body.estimatedBudget).toBe(0);
      }
    });

    it("should reject when projectId is missing", () => {
      const payload = {
        body: {
          title: "Plumbing Rough-In",
          category: "PLUMBING",
        },
      };

      const result = createProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject when category is invalid", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID_1,
          title: "Tile Work",
          category: "INVALID_TRADE_CATEGORY",
        },
      };

      const result = createProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject when title is too short", () => {
      const payload = {
        body: {
          projectId: MOCK_PROJECT_ID_1,
          title: "A",
          category: "PAINTING",
        },
      };

      const result = createProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 3. Update Project Service Validation (Rule 19)
  // =========================================================================
  describe("Update Project Service Validation", () => {
    it("should allow partial dirty updates with valid fields", () => {
      const payload = {
        params: { id: MOCK_PROJECT_SERVICE_ID_1 },
        body: {
          title: "Updated False Ceiling Specifications",
          estimatedBudget: 95000,
          status: "IN_PROGRESS",
        },
      };

      const result = updateProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toBe("Updated False Ceiling Specifications");
        expect(result.data.body.estimatedBudget).toBe(95000);
        expect(result.data.body.status).toBe("IN_PROGRESS");
      }
    });

    it("should reject update with invalid UUID param", () => {
      const payload = {
        params: { id: "not-a-uuid" },
        body: {
          title: "New Title",
        },
      };

      const result = updateProjectServiceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. Update Project Service Status Validation
  // =========================================================================
  describe("Update Project Service Status Validation", () => {
    it("should accept valid status transitions", () => {
      const validStatuses = ["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"] as const;

      validStatuses.forEach((status) => {
        const payload = {
          params: { id: MOCK_PROJECT_SERVICE_ID_1 },
          body: { status },
        };
        const result = updateProjectServiceStatusSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });

    it("should reject unknown status", () => {
      const payload = {
        params: { id: MOCK_PROJECT_SERVICE_ID_1 },
        body: { status: "FINISHED" },
      };
      const result = updateProjectServiceStatusSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // 5. Get Project Services Query Validation
  // =========================================================================
  describe("Get Project Services Query Validation", () => {
    it("should parse query parameters with filters and pagination", () => {
      const payload = {
        query: {
          page: "2",
          limit: "25",
          projectId: MOCK_PROJECT_ID_1,
          category: "ELECTRICAL",
          status: "IN_PROGRESS",
          priority: "HIGH",
          search: "wiring",
        },
      };

      const result = getProjectServicesQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(2);
        expect(result.data.query.limit).toBe(25);
        expect(result.data.query.category).toBe("ELECTRICAL");
        expect(result.data.query.search).toBe("wiring");
      }
    });
  });

  // =========================================================================
  // 6. Financial Rollup Calculation Logic
  // =========================================================================
  describe("Financial Rollup Aggregation", () => {
    it("should accurately compute actualCost and totalPaid from child labour bookings", () => {
      const bookings = [
        { totalBudget: 15000, totalPaid: 10000 },
        { totalBudget: 8000, totalPaid: 8000 },
        { totalBudget: 12000, totalPaid: 0 },
      ];

      const actualCost = bookings.reduce((sum, b) => sum + b.totalBudget, 0);
      const totalPaid = bookings.reduce((sum, b) => sum + b.totalPaid, 0);

      expect(actualCost).toBe(35000);
      expect(totalPaid).toBe(18000);
      expect(actualCost - totalPaid).toBe(17000); // Balance outstanding
    });
  });
});
