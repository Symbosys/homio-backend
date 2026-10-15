import { describe, it, expect } from "bun:test";
import {
  getDashboardAlertsQuerySchema,
  getDashboardOverviewQuerySchema,
} from "../../src/module/dashboard/validators/dashboard.validator.js";
import { DashboardService } from "../../src/module/dashboard/services/dashboard.service.js";

import type { DashboardRepository } from "../../src/module/dashboard/repos/dashboard.repo.js";
import { TaskStatus, ProjectHealth, ProjectStage } from "../../src/types/types.js";

const MOCK_ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_EMPLOYEE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";

describe("Dashboard Operations Alerts Module Tests", () => {
  // =========================================================================
  // 1. Validator Schema Tests
  // =========================================================================
  describe("Dashboard Validator Schemas", () => {
    it("should parse valid query parameters with valid employee UUID and limit", () => {
      const payload = {
        query: {
          employeeId: MOCK_EMPLOYEE_ID,
          limit: "15",
        },
      };

      const result = getDashboardAlertsQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.employeeId).toBe(MOCK_EMPLOYEE_ID);
        expect(result.data.query.limit).toBe(15);
      }
    });

    it("should accept empty query parameters and default limit to 20", () => {
      const payload = {
        query: {},
      };

      const result = getDashboardAlertsQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.limit).toBe(20);
        expect(result.data.query.employeeId).toBeUndefined();
      }
    });

    it("should reject invalid non-UUID employeeId", () => {
      const payload = {
        query: {
          employeeId: "not-a-valid-uuid",
        },
      };

      const result = getDashboardAlertsQuerySchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject limit below 1 or above 50", () => {
      const resultZero = getDashboardAlertsQuerySchema.safeParse({ query: { limit: "0" } });
      const resultTooHigh = getDashboardAlertsQuerySchema.safeParse({ query: { limit: "100" } });

      expect(resultZero.success).toBe(false);
      expect(resultTooHigh.success).toBe(false);
    });

    it("should parse valid dashboard overview query with timeframe and employeeId", () => {
      const payload = {
        query: {
          employeeId: MOCK_EMPLOYEE_ID,
          timeframe: "THIS_WEEK",
        },
      };

      const result = getDashboardOverviewQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.employeeId).toBe(MOCK_EMPLOYEE_ID);
        expect(result.data.query.timeframe).toBe("THIS_WEEK");
      }
    });

    it("should default timeframe to THIS_MONTH when omitted in overview query", () => {
      const payload = {
        query: {},
      };

      const result = getDashboardOverviewQuerySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.timeframe).toBe("THIS_MONTH");
      }
    });
  });


  // =========================================================================
  // 2. Service Alert Synthesis & Prioritization Tests
  // =========================================================================
  describe("DashboardService Alert Synthesis Logic", () => {
    it("should aggregate, map and prioritize live alerts across tasks and projects", async () => {
      const now = new Date();
      const pastDueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      const futureHandoverDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days ahead

      // Mock repository returning one of each scenario
      const mockRepo: Partial<DashboardRepository> = {
        findTasksUnderReview: async () => [
          {
            id: "task-001",
            taskCode: "TASK-2026-0001",
            title: "3D Kitchen Modular Elevation",
            submittedForReviewAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 mins ago
            updatedAt: new Date(),
            projectId: "prj-001",
            project: { id: "prj-001", name: "Skyline Villa", projectCode: "PRJ-2026-0001" },
            assignedTo: {
              id: MOCK_EMPLOYEE_ID,
              employeeCode: "EMP-001",
              user: { firstName: "Rahul", lastName: "Verma" },
            },
          },
        ],
        findOverdueTasks: async () => [
          {
            id: "task-002",
            taskCode: "TASK-2026-0002",
            title: "Site Laser Dimension Verification",
            dueDate: pastDueDate,
            priority: "URGENT" as any,
            status: TaskStatus.TODO,
            projectId: "prj-002",
            project: { id: "prj-002", name: "Grand Penthouse", projectCode: "PRJ-2026-0002" },
            assignedTo: null,
          },
        ],
        findReworkTasks: async () => [
          {
            id: "task-003",
            taskCode: "TASK-2026-0003",
            title: "Tile Specification BOQ",
            reviewRemarks: "Italian marble grade not specified",
            reviewedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            updatedAt: new Date(),
            projectId: "prj-001",
            project: null,
          },
        ],
        findAtRiskProjects: async () => [
          {
            id: "prj-risk-001",
            projectCode: "PRJ-2026-0010",
            name: "Emerald Green Villa #12",
            health: ProjectHealth.AT_RISK,
            currentStage: ProjectStage.EXECUTION,
            updatedAt: new Date(now.getTime() - 30 * 60 * 1000),
            site: { siteName: "Tower 4", city: "Bangalore" },
          },
        ],
        findUpcomingHandoverProjects: async () => [
          {
            id: "prj-handover-001",
            projectCode: "PRJ-2026-0020",
            name: "Aura Creative Studio",
            currentStage: ProjectStage.HANDOVER,
            updatedAt: new Date(),
            schedule: {
              siteHandoverDate: futureHandoverDate,
              plannedEndDate: futureHandoverDate,
            },
            site: { siteName: "Studio Hub", city: "Pune" },
          },
        ],
      };

      const service = new DashboardService(mockRepo as DashboardRepository);
      const alerts = await service.getOperationsAlerts(MOCK_ORG_ID, { limit: 10 });

      // Verifications
      expect(alerts.length).toBe(5);

      // Verify severity sorting: CRITICAL items must appear at the top
      expect(alerts[0]?.severity).toBe("CRITICAL");
      expect(alerts[1]?.severity).toBe("CRITICAL");

      // Check Overdue Task alert format
      const overdueAlert = alerts.find((a) => a.type === "OVERDUE_TASK");
      expect(overdueAlert).toBeDefined();
      expect(overdueAlert?.title).toBe("Critical Task Overdue");
      expect(overdueAlert?.actionLabel).toBe("View Task");
      expect(overdueAlert?.actionUrl).toContain("/crm/tasks?search=TASK-2026-0002");

      // Check Under Review alert format
      const reviewAlert = alerts.find((a) => a.type === "UNDER_REVIEW_TASK");
      expect(reviewAlert).toBeDefined();
      expect(reviewAlert?.title).toBe("Tasks Submitted Under Review");
      expect(reviewAlert?.description).toContain("Rahul Verma");
      expect(reviewAlert?.actionLabel).toBe("Review Tasks");

      // Check Project At Risk alert format
      const riskAlert = alerts.find((a) => a.type === "PROJECT_AT_RISK");
      expect(riskAlert).toBeDefined();
      expect(riskAlert?.severity).toBe("CRITICAL");
      expect(riskAlert?.description).toContain("Bangalore");
      expect(riskAlert?.actionLabel).toBe("Inspect Project");

      // Check Upcoming Handover alert format
      const handoverAlert = alerts.find((a) => a.type === "PROJECT_HANDOVER_DUE");
      expect(handoverAlert).toBeDefined();
      expect(handoverAlert?.severity).toBe("INFO");
      expect(handoverAlert?.actionLabel).toBe("View Handover");

      // Check Re-Work alert format
      const reworkAlert = alerts.find((a) => a.type === "TASK_REWORK");
      expect(reworkAlert).toBeDefined();
      expect(reworkAlert?.description).toContain("Italian marble grade not specified");
      expect(reworkAlert?.actionLabel).toBe("Re-Work Deliverable");
    });

    it("should respect limit parameter and cap the total alerts", async () => {
      const mockRepo: Partial<DashboardRepository> = {
        findTasksUnderReview: async () => [
          {
            id: "t1",
            taskCode: "TASK-1",
            title: "Task 1",
            submittedForReviewAt: new Date(),
            updatedAt: new Date(),
            projectId: null,
            project: null,
            assignedTo: null,
          },
          {
            id: "t2",
            taskCode: "TASK-2",
            title: "Task 2",
            submittedForReviewAt: new Date(),
            updatedAt: new Date(),
            projectId: null,
            project: null,
            assignedTo: null,
          },
        ],
        findOverdueTasks: async () => [],
        findReworkTasks: async () => [],
        findAtRiskProjects: async () => [],
        findUpcomingHandoverProjects: async () => [],
      };

      const service = new DashboardService(mockRepo as DashboardRepository);
      const alerts = await service.getOperationsAlerts(MOCK_ORG_ID, { limit: 1 });
      expect(alerts.length).toBe(1);
    });

    it("should synthesize live dashboard overview analytics across tasks and projects", async () => {
      const mockRepo: Partial<DashboardRepository> = {
        getTasksForDashboard: async () => [
          {
            id: "t-1",
            taskCode: "TSK-01",
            title: "Survey Measure",
            type: "SITE_MEASUREMENT" as any,
            priority: "URGENT" as any,
            status: TaskStatus.UNDER_REVIEW,
            checklistTotal: 4,
            checklistCompleted: 4,
            progressPercentage: 100,
            startDate: new Date(),
            dueDate: new Date(),
            submittedForReviewAt: new Date(),
            completedAt: null,
            reviewedAt: null,
            reviewRemarks: null,
            estimatedHours: 5,
            actualHours: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
            projectId: "p-1",
            project: { id: "p-1", name: "Villa Solarium", projectCode: "PRJ-01" },
            assignedTo: null,
          },
        ],
        getProjectsForDashboard: async () => [
          {
            id: "p-1",
            projectCode: "PRJ-01",
            name: "Villa Solarium",
            type: "RESIDENTIAL" as any,
            status: "IN_PROGRESS" as any,
            health: ProjectHealth.HEALTHY,
            currentStage: ProjectStage.EXECUTION,
            isDeleted: false,
            organizationId: MOCK_ORG_ID,
            createdAt: new Date(),
            updatedAt: new Date(),
            customer: { id: "c-1", displayName: "Aarav Sharma", firstName: "Aarav", lastName: "Sharma" },
            site: { siteName: "Villa Site", city: "Bangalore", propertyType: "Villa" },
            schedule: { plannedStartDate: new Date(), plannedEndDate: new Date(), siteHandoverDate: new Date(), actualEndDate: null },
            metric: { progressPercent: 65, designProgress: 100, executionProgress: 50, procurementProgress: 70, qualityScore: 92, safetyScore: 95 },
            commercial: { contractAmount: "5000000" as any, currency: "INR" },
            members: [],
          } as any,
        ],
        findTasksUnderReview: async () => [],
        findOverdueTasks: async () => [],
        findReworkTasks: async () => [],
        findAtRiskProjects: async () => [],
        findUpcomingHandoverProjects: async () => [],
      };

      const service = new DashboardService(mockRepo as DashboardRepository);
      const overview = await service.getOverviewAnalytics(MOCK_ORG_ID, { timeframe: "THIS_MONTH" });

      expect(overview.kpis.activeProjects).toBe(1);
      expect(overview.kpis.projectsInExecution).toBe(1);
      expect(overview.kpis.tasksUnderReview).toBe(1);
      expect(overview.taskVelocity.underReview).toBe(1);
      expect(overview.activeProjects.length).toBe(1);
      expect(overview.activeProjects[0]?.name).toBe("Villa Solarium");
      expect(overview.activeProjects[0]?.customerName).toBe("Aarav Sharma");
      expect(overview.activeProjects[0]?.contractAmountLakhs).toBe(50);
    });
  });
});

