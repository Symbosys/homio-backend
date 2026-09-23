import { describe, it, expect } from "bun:test";
import {
  createCustomTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateTaskPrioritySchema,
  addAssigneesSchema,
  addChecklistItemSchema,
  updateChecklistItemSchema,
  addTaskActivitySchema,
  uploadTaskDocumentSchema,
  getTasksQuerySchema,
  getTaskKanbanQuerySchema,
} from "../../src/module/leads-crm/validators/task.validator";
import {
  MOCK_TASK_ID_1,
  MOCK_CHECKLIST_ID,
  MOCK_EMPLOYEE_ID_1,
  MOCK_EMPLOYEE_ID_2,
  MOCK_EMPLOYEE_ID_3,
  MOCK_LEAD_ID,
  sampleTaskPayload,
} from "./fixtures/crm.fixtures";

describe("Tasks API Quality Test Suite (Areas 6 - 9)", () => {
  // =========================================================================
  // Area 6: Task State Machine & Kanban Board Aggregation
  // =========================================================================
  describe("Area 6: Task State Machine & Kanban Board Aggregation", () => {
    it("should validate full task creation with priority, due date, and checklists", () => {
      const result = createCustomTaskSchema.safeParse({
        body: sampleTaskPayload,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toContain("Draft 3D Kitchen Elevation");
        expect(result.data.body.priority).toBe("HIGH");
        expect(result.data.body.status).toBe("TODO");
        expect(result.data.body.assignees?.length).toBe(2);
        expect(result.data.body.checklistItems?.length).toBe(3);
      }
    });

    it("should allow status progression (TODO -> IN_PROGRESS -> IN_REVIEW -> COMPLETED)", () => {
      const statuses = ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as const;
      for (const status of statuses) {
        const res = updateTaskStatusSchema.safeParse({
          params: { id: MOCK_TASK_ID_1 },
          body: { status },
        });
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.body.status).toBe(status);
        }
      }
    });

    it("should validate priority shifts (LOW -> MEDIUM -> HIGH -> URGENT)", () => {
      const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
      for (const priority of priorities) {
        const res = updateTaskPrioritySchema.safeParse({
          params: { id: MOCK_TASK_ID_1 },
          body: { priority },
        });
        expect(res.success).toBe(true);
        if (res.success) {
          expect(res.data.body.priority).toBe(priority);
        }
      }
    });

    it("should validate Kanban board filter queries", () => {
      const kanbanQuery = {
        query: {
          leadId: MOCK_LEAD_ID,
          employeeId: MOCK_EMPLOYEE_ID_1,
          priority: "HIGH",
          type: "DESIGN_DRAFT",
        },
      };

      const result = getTaskKanbanQuerySchema.safeParse(kanbanQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.leadId).toBe(MOCK_LEAD_ID);
        expect(result.data.query.priority).toBe("HIGH");
        expect(result.data.query.type).toBe("DESIGN_DRAFT");
      }
    });
  });

  // =========================================================================
  // Area 7: Multi-Employee Task Assignees (TaskAssignee)
  // =========================================================================
  describe("Area 7: Multi-Employee Task Assignees (TaskAssignee)", () => {
    it("should validate adding multiple employee assignees to an existing task", () => {
      const addAssigneesPayload = {
        params: { id: MOCK_TASK_ID_1 },
        body: {
          assignees: [
            {
              employeeId: MOCK_EMPLOYEE_ID_2,
              isPrimary: false,
            },
            {
              employeeId: MOCK_EMPLOYEE_ID_3,
              isPrimary: false,
            },
          ],
        },
      };

      const result = addAssigneesSchema.safeParse(addAssigneesPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.assignees.length).toBe(2);
        expect(result.data.body.assignees[0]?.employeeId).toBe(MOCK_EMPLOYEE_ID_2);
        expect(result.data.body.assignees[1]?.employeeId).toBe(MOCK_EMPLOYEE_ID_3);
      }
    });

    it("should reject invalid UUIDs in employee assignees list", () => {
      const invalidAssignees = addAssigneesSchema.safeParse({
        params: { id: MOCK_TASK_ID_1 },
        body: {
          assignees: [
            {
              employeeId: "not-a-valid-uuid-employee",
              isPrimary: false,
            },
          ],
        },
      });
      expect(invalidAssignees.success).toBe(false);
    });
  });

  // =========================================================================
  // Area 8: Task Checklist Subtasks & Progress
  // =========================================================================
  describe("Area 8: Task Checklist Subtasks & Progress", () => {
    it("should validate creating an individual checklist subtask item", () => {
      const checklistPayload = {
        params: { id: MOCK_TASK_ID_1 },
        body: {
          title: "Get client signoff on counter marble sample",
          sortOrder: 4,
          assignedToId: MOCK_EMPLOYEE_ID_1,
        },
      };

      const result = addChecklistItemSchema.safeParse(checklistPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toBe("Get client signoff on counter marble sample");
        expect(result.data.body.sortOrder).toBe(4);
      }
    });

    it("should validate toggling checklist item completion status", () => {
      const togglePayload = {
        params: { id: MOCK_TASK_ID_1, itemId: MOCK_CHECKLIST_ID },
        body: {
          isCompleted: true,
        },
      };

      const result = updateChecklistItemSchema.safeParse(togglePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.isCompleted).toBe(true);
      }
    });

    it("should validate updating checklist title and reordering sortOrder", () => {
      const updatePayload = {
        params: { id: MOCK_TASK_ID_1, itemId: MOCK_CHECKLIST_ID },
        body: {
          title: "Verify structural duct layout and HVAC vents",
          sortOrder: 1,
        },
      };

      const result = updateChecklistItemSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.title).toBe("Verify structural duct layout and HVAC vents");
        expect(result.data.body.sortOrder).toBe(1);
      }
    });
  });

  // =========================================================================
  // Area 9: Task Activity Feed, Comments & File Attachments
  // =========================================================================
  describe("Area 9: Task Activity Feed, Comments & File Attachments", () => {
    it("should validate adding manual audit/collaboration comments to task timeline", () => {
      const commentPayload = {
        params: { id: MOCK_TASK_ID_1 },
        body: {
          content: "Spoke with client. They prefer Matte finish over Glossy acrylic.",
          type: "COMMENT",
        },
      };

      const result = addTaskActivitySchema.safeParse(commentPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.content).toContain("Matte finish over Glossy acrylic");
        expect(result.data.body.type).toBe("COMMENT");
      }
    });

    it("should validate task document upload schema", () => {
      const taskDocPayload = {
        params: { id: MOCK_TASK_ID_1 },
        body: {
          name: "Modular Kitchen Technical Specification v1.2.pdf",
        },
      };

      const result = uploadTaskDocumentSchema.safeParse(taskDocPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe(
          "Modular Kitchen Technical Specification v1.2.pdf"
        );
      }
    });

    it("should validate paginated tasks list query", () => {
      const taskListQuery = {
        query: {
          page: 1,
          limit: 25,
          status: "IN_PROGRESS",
          priority: "HIGH",
          leadId: MOCK_LEAD_ID,
          sortBy: "dueDate",
          sortOrder: "asc",
        },
      };

      const result = getTasksQuerySchema.safeParse(taskListQuery);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(25);
        expect(result.data.query.status).toBe("IN_PROGRESS");
        expect(result.data.query.priority).toBe("HIGH");
      }
    });

    it("should reject malformed task UUID in update status", () => {
      const result = updateTaskStatusSchema.safeParse({
        params: { id: "invalid-task-uuid" },
        body: { status: "COMPLETED" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject malformed checklist item UUID in update checklist", () => {
      const result = updateChecklistItemSchema.safeParse({
        params: { id: MOCK_TASK_ID_1, itemId: "invalid-item-uuid" },
        body: { isCompleted: true },
      });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Area 10: Task Category (Master Data) & Universal Additional Information
  // =========================================================================
  describe("Task Category (Master Data) & Universal Additional Information", () => {
    const MOCK_TASK_CATEGORY_ID = "55556666-7777-8888-9999-000011112222";

    it("should validate task creation with categoryId and additionalInformation", () => {
      const payload = {
        body: {
          ...sampleTaskPayload,
          categoryId: MOCK_TASK_CATEGORY_ID,
          additionalInformation: {
            customFieldTemplate: "InteriorDesignReview",
            siteCoordinatesVerified: true,
            cadVersionRequired: "2026",
          },
        },
      };

      const result = createCustomTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.categoryId).toBe(MOCK_TASK_CATEGORY_ID);
        expect(result.data.body.additionalInformation?.cadVersionRequired).toBe("2026");
        expect(result.data.body.additionalInformation?.siteCoordinatesVerified).toBe(true);
      }
    });

    it("should validate partial task updates including categoryId and additionalInformation", () => {
      const updatePayload = {
        params: { id: MOCK_TASK_ID_1 },
        body: {
          categoryId: MOCK_TASK_CATEGORY_ID,
          additionalInformation: {
            revisedDeadlineReason: "Client requested additional revision",
          },
        },
      };

      const result = updateTaskSchema.safeParse(updatePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.categoryId).toBe(MOCK_TASK_CATEGORY_ID);
        expect(result.data.body.additionalInformation?.revisedDeadlineReason).toBe(
          "Client requested additional revision"
        );
      }
    });
  });
});

