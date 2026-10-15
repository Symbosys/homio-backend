import { dashboardRepo, DashboardRepository } from "../repos/dashboard.repo.js";
import type {
  GetDashboardAlertsQueryInput,
  GetDashboardOverviewQueryInput,
  TaskProjectAlertResponse,
  DashboardOverviewResponse,
  DayVelocityData,
  TaskTypeCountItem,
  TaskPriorityCountItem,
  StageProgressionItem,
  ProjectHealthTypeItem,
  DashboardActiveProjectItem,
} from "../validators/dashboard.validator.js";
import { ProjectStage, ProjectHealth, TaskStatus, TaskPriority, TaskType } from "../../../types/types.js";

const TASK_TYPE_CONFIG: { type: TaskType; name: string; color: string }[] = [
  { type: TaskType.SITE_MEASUREMENT, name: "Site Measurement", color: "#6366f1" },
  { type: TaskType.DESIGN_DRAFT, name: "Design Draft", color: "#3b82f6" },
  { type: TaskType.QUOTATION_PREP, name: "Quotation Prep", color: "#06b6d4" },
  { type: TaskType.MATERIAL_SELECTION, name: "Material Selection", color: "#10b981" },
  { type: TaskType.CLIENT_REVIEW, name: "Client Review", color: "#8b5cf6" },
  { type: TaskType.SITE_INSPECTION, name: "Site Inspection", color: "#f59e0b" },
  { type: TaskType.DOCUMENT_VERIFICATION, name: "Doc Verification", color: "#ec4899" },
  { type: TaskType.PAYMENT_FOLLOWUP, name: "Payment Follow-up", color: "#14b8a6" },
  { type: TaskType.GENERAL, name: "General", color: "#94a3b8" },
  { type: TaskType.OTHER, name: "Other", color: "#64748b" },
];

const STAGE_CONFIG: { key: ProjectStage; label: string }[] = [
  { key: ProjectStage.ONBOARDING, label: "Onboarding" },
  { key: ProjectStage.SURVEY, label: "Survey" },
  { key: ProjectStage.DESIGN, label: "Design" },
  { key: ProjectStage.APPROVAL, label: "Approval" },
  { key: ProjectStage.PROCUREMENT, label: "Procure" },
  { key: ProjectStage.EXECUTION, label: "Execution" },
  { key: ProjectStage.HANDOVER, label: "Handover" },
  { key: ProjectStage.AFTER_SALES, label: "After-Sales" },
];

/**
 * Service orchestrating Dashboard operations alerts & live analytics synthesis
 */
export class DashboardService {
  constructor(private readonly repo: DashboardRepository = dashboardRepo) {}

  /**
   * Synthesize comprehensive live dashboard analytics for Overview page
   */
  async getOverviewAnalytics(
    organizationId: string,
    query: GetDashboardOverviewQueryInput
  ): Promise<DashboardOverviewResponse> {
    const { employeeId } = query;
    const now = new Date();

    // Query live records in parallel from DB
    const [tasks, projects, alerts] = await Promise.all([
      this.repo.getTasksForDashboard(organizationId, employeeId),
      this.repo.getProjectsForDashboard(organizationId),
      this.getOperationsAlerts(organizationId, { employeeId, limit: 15 }),
    ]);

    // Filter active running projects (excluding COMPLETED, CLOSED, CANCELLED)
    const activeProjects = projects.filter(
      (p) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status)
    );

    // 1. Compute KPIs
    const projectsInExecution = activeProjects.filter((p) => p.currentStage === ProjectStage.EXECUTION).length;
    const projectsInDesign = activeProjects.filter((p) => p.currentStage === ProjectStage.DESIGN).length;
    const projectsHealthy = activeProjects.filter((p) => p.health === ProjectHealth.HEALTHY).length;
    const projectsAtRisk = activeProjects.filter(
      (p) => p.health === ProjectHealth.AT_RISK || p.health === ProjectHealth.NEED_ATTENTION
    ).length;

    const tasksCompleted = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const tasksPending = tasks.filter((t) =>
      ([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.RE_WORK, TaskStatus.ON_HOLD] as TaskStatus[]).includes(t.status)
    ).length;
    const tasksUnderReview = tasks.filter((t) => t.status === TaskStatus.UNDER_REVIEW).length;
    const tasksOverdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED
    ).length;

    const totalTasks = tasks.length;
    const taskResolutionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;

    const kpis = {
      activeProjects: activeProjects.length,
      projectsInExecution,
      projectsInDesign,
      tasksCompleted,
      tasksPending,
      tasksUnderReview,
      tasksOverdue,
      projectsAtRisk,
      projectsHealthy,
      taskResolutionRate,
    };

    // 2. Compute Task Status Velocity (Last 7 Days)
    const weeklyTrend: DayVelocityData[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split("T")[0] || ""; // YYYY-MM-DD
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });

      const dayTasks = tasks.filter((t) => {
        const created = t.createdAt ? new Date(t.createdAt).toISOString().split("T")[0] : null;
        const updated = t.updatedAt ? new Date(t.updatedAt).toISOString().split("T")[0] : null;
        const completed = t.completedAt ? new Date(t.completedAt).toISOString().split("T")[0] : null;
        return created === dateString || updated === dateString || completed === dateString;
      });

      weeklyTrend.push({
        day: dayName,
        date: dateString,
        completed: dayTasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
        inProgress: dayTasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
        underReview: dayTasks.filter((t) => t.status === TaskStatus.UNDER_REVIEW).length,
        todo: dayTasks.filter((t) => t.status === TaskStatus.TODO).length,
        rework: dayTasks.filter((t) => t.status === TaskStatus.RE_WORK).length,
        overdue: dayTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED
        ).length,
      });
    }

    const taskVelocity = {
      weeklyTrend,
      completed: tasksCompleted,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      underReview: tasksUnderReview,
      todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
      rework: tasks.filter((t) => t.status === TaskStatus.RE_WORK).length,
      onHold: tasks.filter((t) => t.status === TaskStatus.ON_HOLD).length,
      overdue: tasksOverdue,
      total: totalTasks,
      rate: taskResolutionRate,
    };

    // 3. Compute Task Distribution (Type & Priority)
    const byTypeMap: Record<string, number> = {};
    const byPriorityMap: Record<string, number> = {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    let checklistTotal = 0;
    let checklistCompleted = 0;
    let estimatedHours = 0;
    let actualHours = 0;

    for (const t of tasks) {
      // Exclude PROJECT_MILESTONE as required
      if (t.type !== TaskType.PROJECT_MILESTONE) {
        byTypeMap[t.type] = (byTypeMap[t.type] || 0) + 1;
      }
      if (t.priority && byPriorityMap[t.priority] !== undefined) {
        byPriorityMap[t.priority] = (byPriorityMap[t.priority] ?? 0) + 1;
      }
      checklistTotal += t.checklistTotal || 0;
      checklistCompleted += t.checklistCompleted || 0;
      estimatedHours += t.estimatedHours || 0;
      actualHours += t.actualHours || 0;
    }

    const byType: TaskTypeCountItem[] = TASK_TYPE_CONFIG.map((cfg) => ({
      name: cfg.name,
      type: cfg.type,
      value: byTypeMap[cfg.type] || 0,
      color: cfg.color,
    }));

    const byPriority: TaskPriorityCountItem[] = [
      { name: "Urgent", priority: TaskPriority.URGENT, value: byPriorityMap.URGENT ?? 0, color: "#f43f5e" },
      { name: "High", priority: TaskPriority.HIGH, value: byPriorityMap.HIGH ?? 0, color: "#f59e0b" },
      { name: "Medium", priority: TaskPriority.MEDIUM, value: byPriorityMap.MEDIUM ?? 0, color: "#3b82f6" },
      { name: "Low", priority: TaskPriority.LOW, value: byPriorityMap.LOW ?? 0, color: "#10b981" },
    ];


    const checklistProgressPercent = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

    const taskDistribution = {
      byType,
      byPriority,
      checklistTotal,
      checklistCompleted,
      checklistProgressPercent,
      estimatedHours: Math.round(estimatedHours),
      actualHours: Math.round(actualHours),
    };

    // 4. Compute Project Stage Progression & Health
    const stages: StageProgressionItem[] = STAGE_CONFIG.map((cfg) => {
      const stageProjects = activeProjects.filter((p) => p.currentStage === cfg.key);
      const activeCount = stageProjects.length;
      let totalProgress = 0;
      for (const p of stageProjects) {
        totalProgress += p.metric?.progressPercent || 0;
      }
      const avg = activeCount > 0 ? Math.round(totalProgress / activeCount) : 0;
      return {
        stage: cfg.label,
        key: cfg.key,
        activeProjects: activeCount,
        avgProgress: avg,
      };
    });

    // Group projects by Type and Health
    const typeGroupMap: Record<string, { total: number; healthy: number; risk: number }> = {};
    for (const p of activeProjects) {
      const typeKey = p.type || "TURNKEY";
      if (!typeGroupMap[typeKey]) {
        typeGroupMap[typeKey] = { total: 0, healthy: 0, risk: 0 };
      }
      typeGroupMap[typeKey].total++;
      if (p.health === ProjectHealth.HEALTHY) {
        typeGroupMap[typeKey].healthy++;
      } else {
        typeGroupMap[typeKey].risk++;
      }
    }

    const healthTypes: ProjectHealthTypeItem[] = Object.entries(typeGroupMap).map(([typeKey, val]) => ({
      category: typeKey.replace(/_/g, " "),
      count: val.total,
      healthy: val.healthy,
      risk: val.risk,
    }));

    let totalExecutionProgress = 0;
    for (const p of activeProjects) {
      totalExecutionProgress += p.metric?.executionProgress || p.metric?.progressPercent || 0;
    }
    const avgExecutionProgress = activeProjects.length > 0 ? Math.round(totalExecutionProgress / activeProjects.length) : 0;

    const projectStages = {
      stages,
      healthTypes,
      totalActiveSites: activeProjects.length,
      executionSitesCount: projectsInExecution,
      designSitesCount: projectsInDesign,
      avgExecutionProgress,
    };

    // 5. Compute Project Execution Health & SLA
    const healthScore = activeProjects.length > 0 ? Math.round((projectsHealthy / activeProjects.length) * 100) : 100;
    const grade =
      healthScore >= 85
        ? "Healthy & On Schedule"
        : healthScore >= 60
        ? "Needs Attention"
        : "At Risk";

    let sumDesignProgress = 0;
    let sumExecProgress = 0;
    let sumProcureProgress = 0;
    let sumQuality = 0;
    let sumSafety = 0;
    let qualityCount = 0;
    let safetyCount = 0;
    const citiesSet = new Set<string>();

    for (const p of activeProjects) {
      if (p.metric?.designProgress) sumDesignProgress += p.metric.designProgress;
      if (p.metric?.executionProgress) sumExecProgress += p.metric.executionProgress;
      if (p.metric?.procurementProgress) sumProcureProgress += p.metric.procurementProgress;
      if (p.metric?.qualityScore) {
        sumQuality += p.metric.qualityScore;
        qualityCount++;
      }
      if (p.metric?.safetyScore) {
        sumSafety += p.metric.safetyScore;
        safetyCount++;
      }
      if (p.site?.city) citiesSet.add(p.site.city);
    }

    const projectExecutionHealth = {
      healthScore,
      grade,
      designAvgProgress: activeProjects.length > 0 ? Math.round(sumDesignProgress / activeProjects.length) : 0,
      executionAvgProgress: activeProjects.length > 0 ? Math.round(sumExecProgress / activeProjects.length) : 0,
      procurementAvgProgress: activeProjects.length > 0 ? Math.round(sumProcureProgress / activeProjects.length) : 0,
      qualityAuditScore: qualityCount > 0 ? Math.round(sumQuality / qualityCount) : 0,
      safetyAuditScore: safetyCount > 0 ? Math.round(sumSafety / safetyCount) : 0,
      activeCitiesCount: citiesSet.size,
      onTimeSlaRate: healthScore,
    };

    // 6. Map Active Projects for Portfolio Table
    const activeProjectItems: DashboardActiveProjectItem[] = activeProjects.slice(0, 20).map((p) => {
      const leadMember = p.members?.find((m) => m.isPrimary || m.role === "PROJECT_MANAGER" || m.role === "LEAD_DESIGNER");
      const leadPersonnel = leadMember?.employee
        ? `${leadMember.employee.firstName} ${leadMember.employee.lastName || ""}`.trim()
        : "Assigned Team";

      const contractAmount = p.commercial?.contractAmount ? Number(p.commercial.contractAmount) / 100000 : 0;

      const handoverDate = p.schedule?.siteHandoverDate
        ? new Date(p.schedule.siteHandoverDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : p.schedule?.plannedEndDate
        ? new Date(p.schedule.plannedEndDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "TBD";

      return {
        id: p.id,
        projectCode: p.projectCode,
        name: p.name,
        customerName:
          p.customer?.displayName ||
          `${p.customer?.firstName || ""} ${p.customer?.lastName || ""}`.trim() ||
          "Client",
        propertyType: p.site?.propertyType || "Residential Unit",
        city: p.site?.city || "Site Location",
        type: p.type,
        currentStage: p.currentStage,
        executionStatus: p.executionStatus || p.designStatus || "NOT_STARTED",
        leadPersonnel,
        progressPercent: p.metric?.progressPercent || 0,
        contractAmountLakhs: Number(contractAmount.toFixed(1)),
        targetHandover: handoverDate,
        health: p.health,
      };
    });

    return {
      kpis,
      taskVelocity,
      taskDistribution,
      projectStages,
      projectExecutionHealth,
      activeProjects: activeProjectItems,
      alerts,
    };
  }

  /**
   * Synthesize real-time operational alerts across tasks and active project sites
   */
  async getOperationsAlerts(
    organizationId: string,
    query: GetDashboardAlertsQueryInput
  ): Promise<TaskProjectAlertResponse[]> {
    const { employeeId, limit = 20 } = query;

    // Fetch live status bottlenecks in parallel across Task and Project domains
    const [
      underReviewTasks,
      overdueTasks,
      reworkTasks,
      atRiskProjects,
      upcomingHandoverProjects,
    ] = await Promise.all([
      this.repo.findTasksUnderReview(organizationId, employeeId, limit),
      this.repo.findOverdueTasks(organizationId, employeeId, limit),
      this.repo.findReworkTasks(organizationId, employeeId, limit),
      this.repo.findAtRiskProjects(organizationId, limit),
      this.repo.findUpcomingHandoverProjects(organizationId, limit),
    ]);

    const alerts: TaskProjectAlertResponse[] = [];

    // 1. Map Tasks Under Review
    for (const task of underReviewTasks) {
      const assigneeName = task.assignedTo?.user?.firstName
        ? `${task.assignedTo.user.firstName} ${task.assignedTo.user.lastName || ""}`.trim()
        : "Workforce team";

      alerts.push({
        id: `alert-review-${task.id}`,
        title: "Tasks Submitted Under Review",
        description: `${task.taskCode}: "${task.title}" submitted by ${assigneeName} awaiting quality sign-off and approval.`,
        severity: "HIGH",
        type: "UNDER_REVIEW_TASK",
        actionLabel: "Review Tasks",
        actionUrl: `/crm/tasks?search=${encodeURIComponent(task.taskCode)}`,
        timestamp: (task.submittedForReviewAt || task.updatedAt).toISOString(),
        metadata: {
          taskId: task.id,
          taskCode: task.taskCode,
          projectId: task.projectId,
        },
      });
    }

    // 2. Map Overdue Tasks
    for (const task of overdueTasks) {
      const dueDateStr = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })
        : "scheduled date";

      alerts.push({
        id: `alert-overdue-${task.id}`,
        title: "Critical Task Overdue",
        description: `${task.taskCode}: "${task.title}" is past scheduled due deadline (${dueDateStr}).`,
        severity: "CRITICAL",
        type: "OVERDUE_TASK",
        actionLabel: "View Task",
        actionUrl: `/crm/tasks?search=${encodeURIComponent(task.taskCode)}`,
        timestamp: (task.dueDate || new Date()).toISOString(),
        metadata: {
          taskId: task.id,
          taskCode: task.taskCode,
          priority: task.priority,
        },
      });
    }

    // 3. Map Tasks Marked for Re-Work
    for (const task of reworkTasks) {
      alerts.push({
        id: `alert-rework-${task.id}`,
        title: "Deliverable Marked For Re-Work",
        description: `${task.taskCode}: "${task.title}" returned for revision: ${task.reviewRemarks || "Correction requested"}.`,
        severity: "HIGH",
        type: "TASK_REWORK",
        actionLabel: "Re-Work Deliverable",
        actionUrl: `/crm/tasks?search=${encodeURIComponent(task.taskCode)}`,
        timestamp: (task.reviewedAt || task.updatedAt).toISOString(),
        metadata: {
          taskId: task.id,
          taskCode: task.taskCode,
          remarks: task.reviewRemarks,
        },
      });
    }

    // 4. Map Projects At Risk
    for (const project of atRiskProjects) {
      const isCritical = project.health === ProjectHealth.AT_RISK;
      const siteLocation = project.site?.city ? `(${project.site.city})` : "";

      alerts.push({
        id: `alert-risk-${project.id}`,
        title: isCritical ? "Project Site At Risk" : "Project Site Needs Attention",
        description: `${project.projectCode}: "${project.name}" ${siteLocation} flagged for ${isCritical ? "critical execution or procurement bottleneck" : "minor timeline risk"}.`,
        severity: isCritical ? "CRITICAL" : "HIGH",
        type: "PROJECT_AT_RISK",
        actionLabel: "Inspect Project",
        actionUrl: `/projects/all`,
        timestamp: project.updatedAt.toISOString(),
        metadata: {
          projectId: project.id,
          projectCode: project.projectCode,
          health: project.health,
          currentStage: project.currentStage,
        },
      });
    }

    // 5. Map Upcoming Handover Projects
    for (const project of upcomingHandoverProjects) {
      const date = project.schedule?.siteHandoverDate || project.schedule?.plannedEndDate;
      const formattedDate = date
        ? new Date(date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "upcoming";

      alerts.push({
        id: `alert-handover-${project.id}`,
        title: "Handover Inspection Approaching",
        description: `${project.projectCode}: "${project.name}" possession scheduled within 30 days (${formattedDate}).`,
        severity: "INFO",
        type: "PROJECT_HANDOVER_DUE",
        actionLabel: "View Handover",
        actionUrl: `/projects/handovers`,
        timestamp: (date || project.updatedAt).toISOString(),
        metadata: {
          projectId: project.id,
          projectCode: project.projectCode,
          handoverDate: date?.toISOString(),
        },
      });
    }

    // Sort by Severity (CRITICAL > HIGH > MEDIUM > INFO), then timestamp desc
    const severityWeight: Record<TaskProjectAlertResponse["severity"], number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      INFO: 1,
    };

    alerts.sort((a, b) => {
      const weightDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return alerts.slice(0, limit);
  }
}

export const dashboardService = new DashboardService();
