import { z } from "zod";

/**
 * Validation schema for Dashboard Alerts query parameters
 * Supports optional staff/employee scoping and custom limits
 */
export const getDashboardAlertsQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
});

export type GetDashboardAlertsQueryInput = z.infer<typeof getDashboardAlertsQuerySchema>["query"];

export interface TaskProjectAlertResponse {
  id: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  type: "UNDER_REVIEW_TASK" | "OVERDUE_TASK" | "PROJECT_AT_RISK" | "PROJECT_HANDOVER_DUE" | "TASK_REWORK";
  actionLabel?: string;
  actionUrl?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Validation schema for full Dashboard Overview analytics endpoint
 */
export const getDashboardOverviewQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    timeframe: z.enum(["TODAY", "THIS_WEEK", "THIS_MONTH", "THIS_QUARTER", "THIS_YEAR", "CUSTOM"]).optional().default("THIS_MONTH"),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

export type GetDashboardOverviewQueryInput = z.infer<typeof getDashboardOverviewQuerySchema>["query"];

export interface DashboardKpisResponse {
  activeProjects: number;
  projectsInExecution: number;
  projectsInDesign: number;
  tasksCompleted: number;
  tasksPending: number;
  tasksUnderReview: number;
  tasksOverdue: number;
  projectsAtRisk: number;
  projectsHealthy: number;
  taskResolutionRate: number;
}

export interface DayVelocityData {
  day: string;
  date: string;
  completed: number;
  inProgress: number;
  underReview: number;
  todo: number;
  rework: number;
  overdue: number;
}

export interface DashboardTaskVelocityResponse {
  weeklyTrend: DayVelocityData[];
  completed: number;
  inProgress: number;
  underReview: number;
  todo: number;
  rework: number;
  onHold: number;
  overdue: number;
  total: number;
  rate: number;
}

export interface TaskTypeCountItem {
  name: string;
  type: string;
  value: number;
  color: string;
}

export interface TaskPriorityCountItem {
  name: string;
  priority: string;
  value: number;
  color: string;
}

export interface DashboardTaskDistributionResponse {
  byType: TaskTypeCountItem[];
  byPriority: TaskPriorityCountItem[];
  checklistTotal: number;
  checklistCompleted: number;
  checklistProgressPercent: number;
  estimatedHours: number;
  actualHours: number;
}

export interface StageProgressionItem {
  stage: string;
  key: string;
  activeProjects: number;
  avgProgress: number;
}

export interface ProjectHealthTypeItem {
  category: string;
  count: number;
  healthy: number;
  risk: number;
}

export interface DashboardProjectStageResponse {
  stages: StageProgressionItem[];
  healthTypes: ProjectHealthTypeItem[];
  totalActiveSites: number;
  executionSitesCount: number;
  designSitesCount: number;
  avgExecutionProgress: number;
}

export interface DashboardProjectExecutionHealthResponse {
  healthScore: number;
  grade: string;
  designAvgProgress: number;
  executionAvgProgress: number;
  procurementAvgProgress: number;
  qualityAuditScore: number;
  safetyAuditScore: number;
  activeCitiesCount: number;
  onTimeSlaRate: number;
}

export interface DashboardActiveProjectItem {
  id: string;
  projectCode: string;
  name: string;
  customerName: string;
  propertyType: string;
  city: string;
  type: string;
  currentStage: string;
  executionStatus: string;
  leadPersonnel: string;
  progressPercent: number;
  contractAmountLakhs: number;
  targetHandover: string;
  health: string;
}

export interface DashboardOverviewResponse {
  kpis: DashboardKpisResponse;
  taskVelocity: DashboardTaskVelocityResponse;
  taskDistribution: DashboardTaskDistributionResponse;
  projectStages: DashboardProjectStageResponse;
  projectExecutionHealth: DashboardProjectExecutionHealthResponse;
  activeProjects: DashboardActiveProjectItem[];
  alerts: TaskProjectAlertResponse[];
}
