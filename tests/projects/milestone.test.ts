import { describe, it, expect } from "bun:test";
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  getMilestonesQuerySchema,
  toggleChecklistParamSchema,
} from "../../src/module/projects/validators/milestone.validator";
import {
  MOCK_PROJECT_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
} from "../leads-crm/fixtures/crm.fixtures";

describe("Project Milestones Module Tests", () => {
  // =========================================================================
  // 1. Milestone Code Sequential Format Verification
  // =========================================================================
  describe("Milestone Code Format Validation", () => {
    it("should conform to sequential Milestone Code pattern PR-123-M1 / PRJ-2026-0001-M1", () => {
      const codeRegex = /^(?:[A-Z0-9]+-)+M\d+$/;
      expect(codeRegex.test("PR-123-M1")).toBe(true);
      expect(codeRegex.test("PR-123-M2")).toBe(true);
      expect(codeRegex.test("PRJ-2026-0001-M1")).toBe(true);
      expect(codeRegex.test("PRJ-2026-0001-M15")).toBe(true);

      expect(codeRegex.test("INVALID-CODE")).toBe(false);
    });
  });

  // =========================================================================
  // 2. Milestone Creation Payload Validation
  // =========================================================================
  describe("Create Milestone Validation", () => {
    it("should validate complete milestone creation payload with nested checklists and attachments", () => {
      const payload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          milestoneCode: "MS-01",
          name: "False Ceiling & Electrical Rough-in",
          description: "Complete framing, POP sheets, and electrical conduit routing for ground floor.",
          stage: "EXECUTION" as const,
          status: "IN_PROGRESS" as const,
          priority: "HIGH" as const,
          orderIndex: 1,
          startDate: "2026-10-10",
          dueDate: "2026-10-25",
          completionPercent: 30.0,
          assigneeId: MOCK_EMPLOYEE_ID_1,
          approvalRequired: true,
          paymentRequired: true,
          budgetAmount: 450000,
          attachments: [
            {
              id: "doc-101",
              url: "https://storage.homio.in/projects/ceiling-drawing-v2.pdf",
              bytes: 1048576,
              format: "pdf",
              provider: "AWS_S3" as const,
            },
          ],
          checklists: [
            {
              title: "Verify GI channel perimeter level marking",
              isCompleted: true,
              orderIndex: 0,
              dueDate: "2026-10-12",
              assigneeId: MOCK_EMPLOYEE_ID_1,
            },
            {
              title: "Inspect conduit wire pulling test",
              isCompleted: false,
              orderIndex: 1,
              dueDate: "2026-10-18",
              assigneeId: MOCK_EMPLOYEE_ID_2,
            },
            {
              title: "Apply jointing compound and paper tape",
              isCompleted: false,
              orderIndex: 2,
              dueDate: "2026-10-24",
            },
          ],
        },
      };

      const parsed = createMilestoneSchema.parse(payload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.body.name).toBe("False Ceiling & Electrical Rough-in");
      expect(parsed.body.milestoneCode).toBe("MS-01");
      expect(parsed.body.stage).toBe("EXECUTION");
      expect(parsed.body.budgetAmount).toBe(450000);
      expect(parsed.body.checklists?.length).toBe(3);
      expect(parsed.body.checklists?.[0]?.title).toBe("Verify GI channel perimeter level marking");
      expect(parsed.body.checklists?.[0]?.isCompleted).toBe(true);
      expect(parsed.body.checklists?.[1]?.isCompleted).toBe(false);
    });

    it("should allow minimal milestone creation with required dates and name", () => {
      const minimalPayload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          name: "Design Moodboard Approval",
          startDate: "2026-10-01",
          dueDate: "2026-10-07",
        },
      };

      const parsed = createMilestoneSchema.parse(minimalPayload);
      expect(parsed.body.name).toBe("Design Moodboard Approval");
      expect(parsed.body.status).toBe("NOT_STARTED");
      expect(parsed.body.milestoneType).toBe("EXECUTION");
      expect(parsed.body.priority).toBe("MEDIUM");
      expect(parsed.body.checklists).toEqual([]);
    });

    it("should validate DESIGN milestone creation and filtering", () => {
      const designPayload = {
        params: { projectId: MOCK_PROJECT_ID },
        body: {
          milestoneCode: "MS-01",
          milestoneType: "DESIGN" as const,
          name: "3D Visualizations & Material Board Approval",
          startDate: "2026-10-01",
          dueDate: "2026-10-15",
          stage: "DESIGN" as const,
          checklists: [
            {
              title: "Living room 3D render generation",
              isCompleted: true,
            },
            {
              title: "Material swatch sign-off with client",
              isCompleted: false,
            },
          ],
        },
      };

      const parsed = createMilestoneSchema.parse(designPayload);
      expect(parsed.body.milestoneType).toBe("DESIGN");
      expect(parsed.body.checklists?.length).toBe(2);

      const queryParsed = getMilestonesQuerySchema.parse({
        query: { milestoneType: "DESIGN" },
      });
      expect(queryParsed.query.milestoneType).toBe("DESIGN");
    });

    it("should fail validation if dueDate or startDate is invalid", () => {
      expect(() => {
        createMilestoneSchema.parse({
          params: { projectId: MOCK_PROJECT_ID },
          body: {
            name: "Invalid Date Milestone",
            startDate: "invalid-date",
            dueDate: "2026-10-10",
          },
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // 3. Milestone Checklist Toggle Validation
  // =========================================================================
  describe("Checklist Toggle Validation", () => {
    it("should validate checklist toggle parameter schema", () => {
      const togglePayload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          milestoneId: "11111111-2222-4333-8444-555555555555",
          checklistId: "66666666-7777-4888-8999-000000000000",
        },
        body: {
          isCompleted: true,
        },
      };

      const parsed = toggleChecklistParamSchema.parse(togglePayload);
      expect(parsed.params.projectId).toBe(MOCK_PROJECT_ID);
      expect(parsed.params.checklistId).toBe("66666666-7777-4888-8999-000000000000");
      expect(parsed.body?.isCompleted).toBe(true);
    });
  });

  // =========================================================================
  // 4. Milestone Partial Update Validation
  // =========================================================================
  describe("Update Milestone Validation", () => {
    it("should validate partial milestone update payload", () => {
      const updatePayload = {
        params: {
          projectId: MOCK_PROJECT_ID,
          id: "11111111-2222-4333-8444-555555555555",
        },
        body: {
          status: "COMPLETED" as const,
          completionPercent: 100.0,
          completedAt: "2026-10-24",
        },
      };

      const parsed = updateMilestoneSchema.parse(updatePayload);
      expect(parsed.body.status).toBe("COMPLETED");
      expect(parsed.body.completionPercent).toBe(100.0);
    });
  });

  // =========================================================================
  // 5. Milestone Query Filter Validation
  // =========================================================================
  describe("Get Milestones Query Validation", () => {
    it("should parse milestone list filters", () => {
      const query = {
        stage: "EXECUTION",
        status: "IN_PROGRESS",
        sortBy: "dueDate",
        sortOrder: "asc",
      };

      const parsed = getMilestonesQuerySchema.parse({ query });
      expect(parsed.query.stage).toBe("EXECUTION");
      expect(parsed.query.status).toBe("IN_PROGRESS");
      expect(parsed.query.sortBy).toBe("dueDate");
      expect(parsed.query.sortOrder).toBe("asc");
    });
  });
});
