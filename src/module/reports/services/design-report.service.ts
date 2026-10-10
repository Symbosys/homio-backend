import { designReportRepo, type DateRange } from "../repos/design-report.repo.js";
import type { GetDesignReportsQueryInput } from "../validators/design-report.validator.js";

/**
 * Service orchestrating Design Reports & DAM Analytics calculations
 */
export class DesignReportService {
  /**
   * Resolve date presets to concrete start & end Date objects
   */
  private resolveDateRange(query: GetDesignReportsQueryInput): DateRange {
    const { datePreset, startDate, endDate } = query;
    const now = new Date();

    if (datePreset === "custom" || (!datePreset && (startDate || endDate))) {
      return {
        start: startDate ? new Date(startDate) : undefined,
        end: endDate ? new Date(endDate) : undefined,
      };
    }

    if (datePreset === "all_time") {
      return { start: undefined, end: undefined };
    }

    switch (datePreset) {
      case "today": {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        return { start, end };
      }
      case "yesterday": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        return { start, end };
      }
      case "this_week": {
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const start = new Date(now);
        start.setDate(start.getDate() - diffToMonday);
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      }
      case "last_week": {
        const dayOfWeek = now.getDay();
        const diffToMonday = (dayOfWeek + 6) % 7;
        const start = new Date(now);
        start.setDate(start.getDate() - diffToMonday - 7);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }
      case "this_month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start, end: now };
      }
      case "last_month": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { start, end };
      }
      case "last_3_months": {
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        return { start, end: now };
      }
      case "last_6_months": {
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
        return { start, end: now };
      }
      case "this_year": {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return { start, end: now };
      }
      default: {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { start, end: now };
      }
    }
  }

  /**
   * Main analytics report computation
   */
  async getDesignAnalytics(organizationId: string, query: GetDesignReportsQueryInput) {
    const dateRange = this.resolveDateRange(query);

    const rawData = await designReportRepo.getDesignAnalytics(
      organizationId,
      query,
      dateRange
    );

    const {
      totalDesigns,
      designsByStatus,
      totalVersions,
      allAttachments,
      allApprovals,
      allChangeRequests,
      allProjects,
      employees,
    } = rawData;

    // ------------------------------------------------------------------------
    // 1. KPI SUMMARY METRICS
    // ------------------------------------------------------------------------
    const totalFilesMade = allAttachments.length;

    let totalFilesPending = 0;
    let totalFilesApproved = 0;
    let totalFilesExecutionReady = 0;
    let totalFilesRejected = 0;

    for (const att of allAttachments) {
      const vStatus = att.designVersion?.status;
      const dStatus = att.designVersion?.design?.status;
      const stage = att.designVersion?.design?.folder?.stage;
      const isLocked = att.designVersion?.isLocked;

      if (vStatus === "APPROVED" || dStatus === "APPROVED") {
        totalFilesApproved++;
      } else if (vStatus === "CHANGES_REQUESTED" || vStatus === "REJECTED" || dStatus === "CHANGES_REQUESTED" || dStatus === "REJECTED") {
        totalFilesRejected++;
      } else {
        totalFilesPending++;
      }

      if (
        stage === "GOOD_FOR_CONSTRUCTION_GFC" ||
        stage === "AS_BUILT" ||
        (vStatus === "APPROVED" && isLocked)
      ) {
        totalFilesExecutionReady++;
      }
    }

    const totalDecisions = allApprovals.length;
    const approvedDecisions = allApprovals.filter(
      (a) => a.decision === "APPROVED" || a.decision === "APPROVED_WITH_CONDITIONS"
    ).length;
    const rejectedDecisions = allApprovals.filter((a) => a.decision === "REJECTED").length;
    const approvalRatePercent = totalDecisions > 0 ? Number(((approvedDecisions / totalDecisions) * 100).toFixed(1)) : 0;

    const ratedApprovals = allApprovals.filter((a) => typeof a.clientRating === "number" && a.clientRating > 0);
    const avgClientRating =
      ratedApprovals.length > 0
        ? Number(
            (
              ratedApprovals.reduce((acc, curr) => acc + (curr.clientRating || 0), 0) /
              ratedApprovals.length
            ).toFixed(1)
          )
        : null;

    const avgRevisionsPerDesign =
      totalDesigns > 0 ? Number((totalVersions / totalDesigns).toFixed(1)) : 0;

    // ------------------------------------------------------------------------
    // 2. ATTACHMENT TYPES DISTRIBUTION (Donut / Pie Chart)
    // ------------------------------------------------------------------------
    const typeCountMap: Record<string, number> = {};
    for (const att of allAttachments) {
      typeCountMap[att.attachmentType] = (typeCountMap[att.attachmentType] || 0) + 1;
    }

    const assetTypeDistribution = Object.entries(typeCountMap).map(([type, count]) => ({
      type,
      label: type.replace(/_/g, " "),
      count,
      percentage: totalFilesMade > 0 ? Number(((count / totalFilesMade) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.count - a.count);

    // ------------------------------------------------------------------------
    // 3. EMPLOYEE DESIGN PRODUCTIVITY LEADERBOARD
    // ------------------------------------------------------------------------
    const employeeMetricsMap = new Map<
      string,
      {
        employee: {
          id: string;
          employeeCode: string;
          firstName: string;
          lastName?: string | null;
          displayName?: string | null;
          designation?: string | null;
          avatarUrl?: any;
        };
        totalFilesMade: number;
        renders3DCount: number;
        cadDrawingsCount: number;
        specSheetsCount: number;
        modelsCount: number;
        approvedFilesCount: number;
        executionReadyFilesCount: number;
      }
    >();

    // Initialize all organization employees
    for (const emp of employees) {
      employeeMetricsMap.set(emp.id, {
        employee: emp,
        totalFilesMade: 0,
        renders3DCount: 0,
        cadDrawingsCount: 0,
        specSheetsCount: 0,
        modelsCount: 0,
        approvedFilesCount: 0,
        executionReadyFilesCount: 0,
      });
    }

    let unassignedFilesCount = 0;

    for (const att of allAttachments) {
      if (!att.createdById) {
        unassignedFilesCount++;
        continue;
      }

      let metric = employeeMetricsMap.get(att.createdById);
      if (!metric && att.createdBy) {
        metric = {
          employee: att.createdBy,
          totalFilesMade: 0,
          renders3DCount: 0,
          cadDrawingsCount: 0,
          specSheetsCount: 0,
          modelsCount: 0,
          approvedFilesCount: 0,
          executionReadyFilesCount: 0,
        };
        employeeMetricsMap.set(att.createdById, metric);
      }

      if (metric) {
        metric.totalFilesMade++;

        if (att.attachmentType === "RENDER_IMAGE") {
          metric.renders3DCount++;
        } else if (
          att.attachmentType === "TECHNICAL_DRAWING_PDF" ||
          att.attachmentType === "CAD_DWG_FILE"
        ) {
          metric.cadDrawingsCount++;
        } else if (att.attachmentType === "SPECIFICATION_SHEET") {
          metric.specSheetsCount++;
        } else if (
          att.attachmentType === "THREED_MODEL_FILE" ||
          att.attachmentType === "THREED_PREVIEW_URL" ||
          att.attachmentType === "VIDEO_FILE"
        ) {
          metric.modelsCount++;
        }

        const vStatus = att.designVersion?.status;
        const dStatus = att.designVersion?.design?.status;
        if (vStatus === "APPROVED" || dStatus === "APPROVED") {
          metric.approvedFilesCount++;
        }

        const stage = att.designVersion?.design?.folder?.stage;
        const isLocked = att.designVersion?.isLocked;
        if (
          stage === "GOOD_FOR_CONSTRUCTION_GFC" ||
          stage === "AS_BUILT" ||
          (vStatus === "APPROVED" && isLocked)
        ) {
          metric.executionReadyFilesCount++;
        }
      }
    }

    const employeeLeaderboard = Array.from(employeeMetricsMap.values())
      .map((m) => ({
        ...m,
        productivitySharePercent:
          totalFilesMade > 0 ? Number(((m.totalFilesMade / totalFilesMade) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.totalFilesMade - a.totalFilesMade);

    // ------------------------------------------------------------------------
    // 4. PROJECT DESIGN ANALYTICS
    // ------------------------------------------------------------------------
    const projectMetricsMap = new Map<
      string,
      {
        projectId: string;
        projectCode: string;
        projectName: string;
        status: string;
        totalDesigns: number;
        totalFilesMade: number;
        pendingFiles: number;
        approvedFiles: number;
        rejectedFiles: number;
        executionReadyFiles: number;
      }
    >();

    for (const p of allProjects) {
      projectMetricsMap.set(p.id, {
        projectId: p.id,
        projectCode: p.projectCode,
        projectName: p.name,
        status: p.status,
        totalDesigns: 0,
        totalFilesMade: 0,
        pendingFiles: 0,
        approvedFiles: 0,
        rejectedFiles: 0,
        executionReadyFiles: 0,
      });
    }

    for (const att of allAttachments) {
      const pId = att.designVersion?.design?.projectId;
      if (!pId) continue;

      const pMetric = projectMetricsMap.get(pId);
      if (pMetric) {
        pMetric.totalFilesMade++;

        const vStatus = att.designVersion?.status;
        const dStatus = att.designVersion?.design?.status;
        const stage = att.designVersion?.design?.folder?.stage;
        const isLocked = att.designVersion?.isLocked;

        if (vStatus === "APPROVED" || dStatus === "APPROVED") {
          pMetric.approvedFiles++;
        } else if (vStatus === "CHANGES_REQUESTED" || vStatus === "REJECTED") {
          pMetric.rejectedFiles++;
        } else {
          pMetric.pendingFiles++;
        }

        if (
          stage === "GOOD_FOR_CONSTRUCTION_GFC" ||
          stage === "AS_BUILT" ||
          (vStatus === "APPROVED" && isLocked)
        ) {
          pMetric.executionReadyFiles++;
        }
      }
    }

    const projectAnalytics = Array.from(projectMetricsMap.values())
      .map((p) => ({
        ...p,
        approvalRatePercent:
          p.totalFilesMade > 0
            ? Number(((p.approvedFiles / p.totalFilesMade) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.totalFilesMade - a.totalFilesMade);

    // ------------------------------------------------------------------------
    // 5. TIMELINE / VELOCITY TREND SERIES
    // ------------------------------------------------------------------------
    const timelineBucketMap = new Map<
      string,
      {
        date: string;
        filesCreated: number;
        approvalsCompleted: number;
        changeRequestsFiled: number;
      }
    >();

    const getBucketKey = (d: Date): string => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    for (const att of allAttachments) {
      const key = getBucketKey(new Date(att.createdAt));
      const entry = timelineBucketMap.get(key) || {
        date: key,
        filesCreated: 0,
        approvalsCompleted: 0,
        changeRequestsFiled: 0,
      };
      entry.filesCreated++;
      timelineBucketMap.set(key, entry);
    }

    for (const app of allApprovals) {
      const key = getBucketKey(new Date(app.decidedAt));
      const entry = timelineBucketMap.get(key) || {
        date: key,
        filesCreated: 0,
        approvalsCompleted: 0,
        changeRequestsFiled: 0,
      };
      entry.approvalsCompleted++;
      timelineBucketMap.set(key, entry);
    }

    for (const cr of allChangeRequests) {
      const key = getBucketKey(new Date(cr.createdAt));
      const entry = timelineBucketMap.get(key) || {
        date: key,
        filesCreated: 0,
        approvalsCompleted: 0,
        changeRequestsFiled: 0,
      };
      entry.changeRequestsFiled++;
      timelineBucketMap.set(key, entry);
    }

    const timelineTrend = Array.from(timelineBucketMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // ------------------------------------------------------------------------
    // 6. CHANGE REQUESTS CATEGORY BREAKDOWN
    // ------------------------------------------------------------------------
    const crCategoryMap: Record<string, number> = {};
    for (const cr of allChangeRequests) {
      crCategoryMap[cr.category] = (crCategoryMap[cr.category] || 0) + 1;
    }

    const changeRequestCategories = Object.entries(crCategoryMap)
      .map(([category, count]) => ({
        category,
        label: category.replace(/_/g, " "),
        count,
        percentage:
          allChangeRequests.length > 0
            ? Number(((count / allChangeRequests.length) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      summary: {
        totalDesigns,
        totalVersions,
        totalFilesMade,
        totalFilesPending,
        totalFilesApproved,
        totalFilesExecutionReady,
        totalFilesRejected,
        unassignedFilesCount,
        approvalRatePercent,
        avgClientRating,
        avgRevisionsPerDesign,
        totalApprovalsRecorded: totalDecisions,
        totalChangeRequestsFiled: allChangeRequests.length,
      },
      assetTypeDistribution,
      employeeLeaderboard,
      projectAnalytics,
      timelineTrend,
      changeRequestCategories,
      dateRange: {
        preset: query.datePreset || "this_month",
        startDate: dateRange.start ? dateRange.start.toISOString() : null,
        endDate: dateRange.end ? dateRange.end.toISOString() : null,
      },
    };
  }
}

export const designReportService = new DesignReportService();
