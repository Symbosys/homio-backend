import { describe, it, expect } from "bun:test";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  submitTaskReviewSchema,
  reviewTaskDecisionSchema,
  getTasksQuerySchema,
} from "../../src/module/tasks/validators/task.validator.js";
import {
  TaskStatus,
  ProjectStage,
  StageStatus,
} from "../../src/types/types.js";

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_PROJECT_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const MOCK_EMPLOYEE_ID_1 = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const MOCK_REVIEWER_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const MOCK_TASK_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

describe("Dedicated Task Module & Stage Progress Calculation Tests", () => {
  // =========================================================================
  // 1. Task Payload Validation (Project Stage & Reviewer)
  // =========================================================================
  describe("Task Validation Schemas", () => {
    it("should validate full task creation with project stage, reviewer, multi-assignees and custom fields", () => {
      const payload = {
        body: {
          title: "Complete 3D Kitchen Elevations & Moodboard",
          description: "Prepare photorealistic modular kitchen renders with acrylic finishes",
          projectId: MOCK_PROJECT_ID,
          stage: ProjectStage.DESIGN,
          priority: "HIGH" as const,
          status: TaskStatus.TODO,
          assignedToId: MOCK_EMPLOYEE_ID_1,
          reviewerId: MOCK_REVIEWER_ID,
          assigneeIds: [MOCK_EMPLOYEE_ID_1],
          startDate: "2026-10-01",
          dueDate: "2026-10-15",
          estimatedHours: 24.5,
          checklist: [
            { title: "Floor plan dimensions check", isCompleted: true },
            { title: "Cabinet internal lighting layout", isCompleted: false },
          ],
          tags: ["kitchen", "3D", "elevation"],
          additionalInformation: {
            renderEngine: "V-Ray 6",
            clientFeedbackRound: 1,
          },
        },
      };

      const result = createTaskSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.stage).toBe(ProjectStage.DESIGN);
        expect(result.data.body.reviewerId).toBe(MOCK_REVIEWER_ID);
        expect(result.data.body.checklist?.length).toBe(2);
      }
    });

    it("should validate review submission payload", () => {
      const payload = {
        params: { id: MOCK_TASK_ID },
        body: { remarks: "Ready for senior architect review" },
      };

      const result = submitTaskReviewSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should validate reviewer decision payload (APPROVE vs REWORK)", () => {
      const approvePayload = {
        params: { id: MOCK_TASK_ID },
        body: { decision: "APPROVE" as const, remarks: "Excellent detail, approved" },
      };
      expect(reviewTaskDecisionSchema.safeParse(approvePayload).success).toBe(true);

      const reworkPayload = {
        params: { id: MOCK_TASK_ID },
        body: { decision: "REWORK" as const, remarks: "Fix hob clearance dimensions" },
      };
      expect(reviewTaskDecisionSchema.safeParse(reworkPayload).success).toBe(true);
    });

    it("should validate query filters with stage and reviewer params", () => {
      const queryPayload = {
        query: {
          projectId: MOCK_PROJECT_ID,
          stage: ProjectStage.DESIGN,
          status: TaskStatus.IN_PROGRESS,
          reviewerId: MOCK_REVIEWER_ID,
          page: "1",
          limit: "10",
        },
      };

      const result = getTasksQuerySchema.safeParse(queryPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(1);
        expect(result.data.query.limit).toBe(10);
      }
    });
  });

  // =========================================================================
  // 2. Dynamic Stage Progress Calculation Logic Tests
  // =========================================================================
  describe("Dynamic Stage Progress Calculation Logic", () => {
    // Stage Calculation helper simulating the engine
    const calculateStageProgress = (tasks: Array<{ stage: ProjectStage; status: TaskStatus; isDeleted?: boolean }>, targetStage: ProjectStage) => {
      const stageTasks = tasks.filter((t) => t.stage === targetStage && !t.isDeleted);
      const total = stageTasks.length;
      const completed = stageTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const inProgress = stageTasks.filter(
        (t) => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.UNDER_REVIEW || t.status === TaskStatus.RE_WORK
      ).length;

      const progressPercent = total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;
      let status: StageStatus = StageStatus.NOT_STARTED;

      if (total > 0) {
        if (completed === total) {
          status = StageStatus.COMPLETED;
        } else if (completed > 0 || inProgress > 0) {
          status = StageStatus.IN_PROGRESS;
        } else {
          status = StageStatus.ASSIGNED;
        }
      }

      return { total, completed, progressPercent, status };
    };

    it("Scenario 1: 4 tasks created in DESIGN stage with 0 completed -> 0% progress", () => {
      const tasks = [
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
      ];

      const res = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(res.total).toBe(4);
      expect(res.completed).toBe(0);
      expect(res.progressPercent).toBe(0);
      expect(res.status).toBe(StageStatus.ASSIGNED);
    });

    it("Scenario 2: 2 of 4 tasks completed in DESIGN stage -> exactly 50% progress", () => {
      const tasks = [
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.IN_PROGRESS },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
      ];

      const res = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(res.total).toBe(4);
      expect(res.completed).toBe(2);
      expect(res.progressPercent).toBe(50);
      expect(res.status).toBe(StageStatus.IN_PROGRESS);
    });

    it("Scenario 3: Remaining 2 tasks completed -> exactly 100% progress and stage COMPLETED", () => {
      const tasks = [
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
      ];

      const res = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(res.total).toBe(4);
      expect(res.completed).toBe(4);
      expect(res.progressPercent).toBe(100);
      expect(res.status).toBe(StageStatus.COMPLETED);
    });

    it("Scenario 4: 4 more tasks added later to DESIGN stage (Total: 8, Completed: 4) -> progress drops back to 50%", () => {
      const tasks = [
        // 4 originally completed
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED },
        // 4 newly added
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.IN_PROGRESS },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
      ];

      const res = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(res.total).toBe(8);
      expect(res.completed).toBe(4);
      expect(res.progressPercent).toBe(50);
      expect(res.status).toBe(StageStatus.IN_PROGRESS);
    });

    it("Scenario 5: 2 uncompleted tasks deleted (Total: 6, Completed: 4) -> progress recalculates to 66.67%", () => {
      const tasks = [
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.COMPLETED, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.IN_PROGRESS, isDeleted: false },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO, isDeleted: true }, // deleted
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO, isDeleted: true }, // deleted
      ];

      const res = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(res.total).toBe(6);
      expect(res.completed).toBe(4);
      expect(res.progressPercent).toBe(66.67);
      expect(res.status).toBe(StageStatus.IN_PROGRESS);
    });

    it("Scenario 6: Cross-stage isolation (SURVEY tasks do not impact DESIGN stage stats)", () => {
      const tasks = [
        { stage: ProjectStage.SURVEY, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.SURVEY, status: TaskStatus.COMPLETED },
        { stage: ProjectStage.DESIGN, status: TaskStatus.TODO },
        { stage: ProjectStage.DESIGN, status: TaskStatus.IN_PROGRESS },
      ];

      const surveyRes = calculateStageProgress(tasks, ProjectStage.SURVEY);
      expect(surveyRes.total).toBe(2);
      expect(surveyRes.completed).toBe(2);
      expect(surveyRes.progressPercent).toBe(100);
      expect(surveyRes.status).toBe(StageStatus.COMPLETED);

      const designRes = calculateStageProgress(tasks, ProjectStage.DESIGN);
      expect(designRes.total).toBe(2);
      expect(designRes.completed).toBe(0);
      expect(designRes.progressPercent).toBe(0);
      expect(designRes.status).toBe(StageStatus.IN_PROGRESS);
    });
  });
});
