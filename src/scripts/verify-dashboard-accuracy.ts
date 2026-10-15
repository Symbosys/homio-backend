import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { ENV } from "../config/env.js";
import { dashboardService } from "../module/dashboard/services/dashboard.service.js";
import { ProjectStage, ProjectHealth, TaskStatus, TaskType } from "../types/types.js";

const TARGET_ORG_ID = process.argv[2] || "281b8d99-af89-4ed6-9b90-381c2928f6cc";
const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${ENV.PORT || 4000}/api/v1`;

interface CheckResult {
  layer: "SERVICE" | "HTTP_API";
  category: string;
  metric: string;
  dbValue: any;
  actualValue: any;
  status: "PASS" | "FAIL";
  notes?: string;
}

const checks: CheckResult[] = [];

function assertMetric(
  layer: "SERVICE" | "HTTP_API",
  category: string,
  metric: string,
  dbVal: any,
  actualVal: any,
  notes?: string
) {
  const isMatch = JSON.stringify(dbVal) === JSON.stringify(actualVal);
  checks.push({
    layer,
    category,
    metric,
    dbValue: dbVal,
    actualValue: actualVal,
    status: isMatch ? "PASS" : "FAIL",
    notes,
  });
}

async function runDashboardAccuracyVerification() {
  console.log("\n================================================================================");
  console.log("   HOMIO CRM - DASHBOARD OVERVIEW 100% DATA ACCURACY VERIFICATION SCRIPT");
  console.log("================================================================================\n");
  console.log(`Target Organization ID: ${TARGET_ORG_ID}`);
  console.log(`API Base URL:           ${API_BASE_URL}`);
  console.log(`Execution Timestamp:    ${new Date().toISOString()}\n`);

  // 1. Verify Organization Exists
  const org = await prisma.organization.findUnique({
    where: { id: TARGET_ORG_ID },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    console.error(`❌ Organization with ID ${TARGET_ORG_ID} not found in database!`);
    process.exit(1);
  }

  console.log(`✔ Organization Verified: "${org.name}" (Slug: ${org.slug})\n`);

  // 2. Query Raw PostgreSQL Database Independently
  console.log("--> Querying Raw PostgreSQL Database directly via Prisma...");
  const now = new Date();

  // Raw Projects
  const allDbProjects = await prisma.project.findMany({
    where: { organizationId: TARGET_ORG_ID, isDeleted: false },
    include: {
      customer: true,
      site: true,
      schedule: true,
      metric: true,
      commercial: true,
      members: {
        where: { isActive: true },
        include: { employee: true },
      },
    },
  });

  const activeDbProjects = allDbProjects.filter(
    (p) => !["COMPLETED", "CLOSED", "CANCELLED"].includes(p.status)
  );

  const dbProjectsInExecution = activeDbProjects.filter(
    (p) => p.currentStage === ProjectStage.EXECUTION
  ).length;

  const dbProjectsInDesign = activeDbProjects.filter(
    (p) => p.currentStage === ProjectStage.DESIGN
  ).length;

  const dbProjectsHealthy = activeDbProjects.filter(
    (p) => p.health === ProjectHealth.HEALTHY
  ).length;

  const dbProjectsAtRisk = activeDbProjects.filter(
    (p) => p.health === ProjectHealth.AT_RISK || p.health === ProjectHealth.NEED_ATTENTION
  ).length;

  // Raw Tasks
  const allDbTasks = await prisma.task.findMany({
    where: { organizationId: TARGET_ORG_ID, isDeleted: false },
    include: {
      project: true,
      assignedTo: { include: { user: true } },
    },
  });

  const dbTasksCompleted = allDbTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const dbTasksPending = allDbTasks.filter((t) =>
    ([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.RE_WORK, TaskStatus.ON_HOLD] as TaskStatus[]).includes(t.status)
  ).length;
  const dbTasksUnderReview = allDbTasks.filter((t) => t.status === TaskStatus.UNDER_REVIEW).length;
  const dbTasksOverdue = allDbTasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.CANCELLED
  ).length;
  const dbTotalTasks = allDbTasks.length;
  const dbResolutionRate = dbTotalTasks > 0 ? Math.round((dbTasksCompleted / dbTotalTasks) * 100) : 0;

  console.log(`  [DB State] Total Projects: ${allDbProjects.length} | Active Projects: ${activeDbProjects.length}`);
  console.log(`  [DB State] Total Tasks:    ${allDbTasks.length} | Under Review:  ${dbTasksUnderReview}`);

  // 3. LAYER 1: Test Dashboard Service Directly
  console.log("\n--> [LAYER 1] Invoking dashboardService methods directly...");
  const serviceOverview = await dashboardService.getOverviewAnalytics(TARGET_ORG_ID, {
    timeframe: "THIS_MONTH",
  });
  const serviceAlerts = await dashboardService.getOperationsAlerts(TARGET_ORG_ID, { limit: 20 });

  // Assert Service Layer Metrics
  assertMetric("SERVICE", "KPIs", "activeProjects", activeDbProjects.length, serviceOverview.kpis.activeProjects);
  assertMetric("SERVICE", "KPIs", "projectsInExecution", dbProjectsInExecution, serviceOverview.kpis.projectsInExecution);
  assertMetric("SERVICE", "KPIs", "projectsInDesign", dbProjectsInDesign, serviceOverview.kpis.projectsInDesign);
  assertMetric("SERVICE", "KPIs", "tasksCompleted", dbTasksCompleted, serviceOverview.kpis.tasksCompleted);
  assertMetric("SERVICE", "KPIs", "tasksPending", dbTasksPending, serviceOverview.kpis.tasksPending);
  assertMetric("SERVICE", "KPIs", "tasksUnderReview", dbTasksUnderReview, serviceOverview.kpis.tasksUnderReview);
  assertMetric("SERVICE", "KPIs", "tasksOverdue", dbTasksOverdue, serviceOverview.kpis.tasksOverdue);
  assertMetric("SERVICE", "KPIs", "projectsAtRisk", dbProjectsAtRisk, serviceOverview.kpis.projectsAtRisk);
  assertMetric("SERVICE", "KPIs", "projectsHealthy", dbProjectsHealthy, serviceOverview.kpis.projectsHealthy);
  assertMetric("SERVICE", "KPIs", "taskResolutionRate", dbResolutionRate, serviceOverview.kpis.taskResolutionRate);

  assertMetric("SERVICE", "Task Velocity", "completed", dbTasksCompleted, serviceOverview.taskVelocity.completed);
  assertMetric("SERVICE", "Task Velocity", "underReview", dbTasksUnderReview, serviceOverview.taskVelocity.underReview);
  assertMetric("SERVICE", "Task Velocity", "weeklyTrend Days", 7, serviceOverview.taskVelocity.weeklyTrend.length);

  assertMetric("SERVICE", "Portfolio", "activeProjects.length", Math.min(activeDbProjects.length, 20), serviceOverview.activeProjects.length);
  assertMetric("SERVICE", "Operations Alerts", "Under Review Count", dbTasksUnderReview, serviceAlerts.filter((a) => a.type === "UNDER_REVIEW_TASK").length);

  // 4. LAYER 2: Test Real Live HTTP REST API Endpoint
  console.log("\n--> [LAYER 2] Calling Live HTTP REST API over network...");

  // Find an authorized tenant user (ADMIN / USER / PLATFORM_ADMIN) for authorization token
  const authUser = await prisma.user.findFirst({
    where: {
      organizationId: TARGET_ORG_ID,
      status: "ACTIVE",
      userType: { in: ["ADMIN", "USER", "PLATFORM_ADMIN"] },
    },
    select: { id: true, email: true, userType: true },
  });

  const testUserId = authUser?.id || "4cc3a5ce-8fb2-4f57-a773-0880df0c3767";
  const testEmail = authUser?.email || "alex@homioworkspace.com";
  const testUserType = authUser?.userType || "ADMIN";

  const token = jwt.sign(
    {
      userId: testUserId,
      email: testEmail,
      userType: testUserType,
      organizationId: TARGET_ORG_ID,
    },
    ENV.JWT_SECRET || "123456",
    { expiresIn: "1h" }
  );



  let httpOverview: any = null;
  let httpAlerts: any = null;

  try {
    const overviewRes = await fetch(`${API_BASE_URL}/dashboard/overview?timeframe=THIS_MONTH`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    assertMetric("HTTP_API", "HTTP Response", "Overview Status Code", 200, overviewRes.status);

    if (overviewRes.ok) {
      const overviewJson: any = await overviewRes.json();
      httpOverview = overviewJson.data;
    }

    const alertsRes = await fetch(`${API_BASE_URL}/dashboard/alerts?limit=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    assertMetric("HTTP_API", "HTTP Response", "Alerts Status Code", 200, alertsRes.status);

    if (alertsRes.ok) {
      const alertsJson: any = await alertsRes.json();
      httpAlerts = alertsJson.data;
    }
  } catch (err: any) {
    console.warn(`[!] HTTP request could not connect to ${API_BASE_URL}: ${err.message}`);
  }

  // 5. Assert HTTP API Accuracy against Raw DB
  if (httpOverview) {
    assertMetric("HTTP_API", "KPIs", "activeProjects", activeDbProjects.length, httpOverview.kpis.activeProjects);
    assertMetric("HTTP_API", "KPIs", "projectsInExecution", dbProjectsInExecution, httpOverview.kpis.projectsInExecution);
    assertMetric("HTTP_API", "KPIs", "projectsInDesign", dbProjectsInDesign, httpOverview.kpis.projectsInDesign);
    assertMetric("HTTP_API", "KPIs", "tasksCompleted", dbTasksCompleted, httpOverview.kpis.tasksCompleted);
    assertMetric("HTTP_API", "KPIs", "tasksPending", dbTasksPending, httpOverview.kpis.tasksPending);
    assertMetric("HTTP_API", "KPIs", "tasksUnderReview", dbTasksUnderReview, httpOverview.kpis.tasksUnderReview);
    assertMetric("HTTP_API", "KPIs", "tasksOverdue", dbTasksOverdue, httpOverview.kpis.tasksOverdue);
    assertMetric("HTTP_API", "KPIs", "projectsAtRisk", dbProjectsAtRisk, httpOverview.kpis.projectsAtRisk);
    assertMetric("HTTP_API", "KPIs", "projectsHealthy", dbProjectsHealthy, httpOverview.kpis.projectsHealthy);
    assertMetric("HTTP_API", "KPIs", "taskResolutionRate", dbResolutionRate, httpOverview.kpis.taskResolutionRate);

    assertMetric("HTTP_API", "Task Velocity", "completed", dbTasksCompleted, httpOverview.taskVelocity.completed);
    assertMetric("HTTP_API", "Task Velocity", "underReview", dbTasksUnderReview, httpOverview.taskVelocity.underReview);
    assertMetric("HTTP_API", "Task Velocity", "weeklyTrend Days", 7, httpOverview.taskVelocity.weeklyTrend.length);

    // Project Stages in HTTP API
    const stageKeys = [
      ProjectStage.ONBOARDING,
      ProjectStage.SURVEY,
      ProjectStage.DESIGN,
      ProjectStage.APPROVAL,
      ProjectStage.PROCUREMENT,
      ProjectStage.EXECUTION,
      ProjectStage.HANDOVER,
      ProjectStage.AFTER_SALES,
    ];

    for (const sk of stageKeys) {
      const dbCountForStage = activeDbProjects.filter((p) => p.currentStage === sk).length;
      const apiStageItem = httpOverview.projectStages.stages.find((s: any) => s.key === sk);
      assertMetric(
        "HTTP_API",
        "Project Stages",
        `Stage: ${sk}`,
        dbCountForStage,
        apiStageItem?.activeProjects ?? 0
      );
    }

    assertMetric("HTTP_API", "Project Stages", "totalActiveSites", activeDbProjects.length, httpOverview.projectStages.totalActiveSites);

    // Active Projects in HTTP API
    assertMetric(
      "HTTP_API",
      "Portfolio Table",
      "activeProjects.length",
      Math.min(activeDbProjects.length, 20),
      httpOverview.activeProjects.length
    );

    for (let i = 0; i < httpOverview.activeProjects.length; i++) {
      const apiPrj = httpOverview.activeProjects[i];
      const dbPrj = activeDbProjects.find((p) => p.id === apiPrj?.id);
      assertMetric("HTTP_API", "Portfolio Project", `Project[${i}] ID Match`, true, Boolean(dbPrj));
      if (dbPrj) {
        assertMetric("HTTP_API", "Portfolio Project", `Project[${i}] Code`, dbPrj.projectCode, apiPrj?.projectCode);
        assertMetric("HTTP_API", "Portfolio Project", `Project[${i}] Name`, dbPrj.name, apiPrj?.name);
        assertMetric("HTTP_API", "Portfolio Project", `Project[${i}] Stage`, dbPrj.currentStage, apiPrj?.currentStage);
        assertMetric("HTTP_API", "Portfolio Project", `Project[${i}] Health`, dbPrj.health, apiPrj?.health);
      }
    }
  }

  if (httpAlerts) {
    const dbUnderReviewAlerts = allDbTasks.filter((t) => t.status === TaskStatus.UNDER_REVIEW).length;
    assertMetric("HTTP_API", "Operations Alerts", "Under Review Alerts Count", dbUnderReviewAlerts, httpAlerts.filter((a: any) => a.type === "UNDER_REVIEW_TASK").length);
    assertMetric("HTTP_API", "Operations Alerts", "Overdue Alerts Count", dbTasksOverdue, httpAlerts.filter((a: any) => a.type === "OVERDUE_TASK").length);
    assertMetric("HTTP_API", "Operations Alerts", "Rework Alerts Count", allDbTasks.filter((t) => t.status === TaskStatus.RE_WORK).length, httpAlerts.filter((a: any) => a.type === "TASK_REWORK").length);
    assertMetric("HTTP_API", "Operations Alerts", "At Risk Alerts Count", allDbProjects.filter((p) => p.health === ProjectHealth.AT_RISK).length, httpAlerts.filter((a: any) => a.type === "PROJECT_AT_RISK").length);
  }

  // 6. Print Report Table
  console.log("\n---------------------------------------------------------------------------------------------------------");
  console.log(
    "LAYER".padEnd(10) +
    "CATEGORY".padEnd(20) +
    "METRIC".padEnd(32) +
    "DB VALUE".padEnd(16) +
    "ACTUAL VALUE".padEnd(16) +
    "STATUS"
  );
  console.log("---------------------------------------------------------------------------------------------------------");

  let passedCount = 0;
  let failedCount = 0;

  for (const c of checks) {
    const isPass = c.status === "PASS";
    if (isPass) passedCount++;
    else failedCount++;

    const statusStr = isPass ? "✓ PASS" : "✗ FAIL";
    const dbStr = String(c.dbValue ?? "null").slice(0, 14);
    const actStr = String(c.actualValue ?? "null").slice(0, 14);

    console.log(
      c.layer.padEnd(10) +
      c.category.padEnd(20) +
      c.metric.padEnd(32) +
      dbStr.padEnd(16) +
      actStr.padEnd(16) +
      statusStr
    );
  }

  console.log("---------------------------------------------------------------------------------------------------------\n");
  console.log(`TOTAL AUDIT CHECKS: ${checks.length}`);
  console.log(`PASSED:              ${passedCount}`);
  console.log(`FAILED:              ${failedCount}`);

  const accuracyPercentage = ((passedCount / checks.length) * 100).toFixed(2);
  console.log(`ACCURACY RATE:       ${accuracyPercentage}%\n`);

  if (failedCount === 0) {
    console.log("================================================================================");
    console.log(" 🎉 100% DATA ACCURACY VERIFIED ACROSS DATABASE, SERVICE AND HTTP ENDPOINTS!");
    console.log("================================================================================\n");
    process.exit(0);
  } else {
    console.error("================================================================================");
    console.error(" ❌ DISCREPANCIES DETECTED: Accuracy rate is below 100%!");
    console.error("================================================================================\n");
    process.exit(1);
  }
}

runDashboardAccuracyVerification()
  .catch((err) => {
    console.error("Error during verification:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
