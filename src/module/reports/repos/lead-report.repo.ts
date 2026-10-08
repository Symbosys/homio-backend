import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetEmployeePerformanceQueryInput,
  GetTopPerformersQueryInput,
} from "../validators/lead-report.validator.js";

export class LeadReportRepository {
  /**
   * Fetch lead conversion performance by employee with timeline and distribution metrics
   */
  async getEmployeePerformance(
    organizationId: string,
    query: GetEmployeePerformanceQueryInput
  ) {
    const {
      employeeId,
      departmentId,
      startDate,
      endDate,
      fromDate,
      toDate,
      groupBy = "month",
      status,
      source,
      projectType,
      priority,
    } = query;

    const effectiveFrom = startDate || fromDate;
    const effectiveTo = endDate || toDate;

    // Base WHERE condition for leads in this organization
    const leadWhere: Prisma.LeadWhereInput = {
      organizationId,
      isDeleted: false,
      ...(effectiveFrom || effectiveTo
        ? {
            createdAt: {
              ...(effectiveFrom
                ? {
                    gte:
                      effectiveFrom.length === 10
                        ? new Date(`${effectiveFrom}T00:00:00.000Z`)
                        : new Date(effectiveFrom),
                  }
                : {}),
              ...(effectiveTo
                ? {
                    lte:
                      effectiveTo.length === 10
                        ? new Date(`${effectiveTo}T23:59:59.999Z`)
                        : new Date(effectiveTo),
                  }
                : {}),
            },
          }
        : {}),
      ...(employeeId ? { assignedToId: employeeId } : {}),
      ...(departmentId
        ? {
            assignedTo: {
              departmentAssignments: {
                some: {
                  departmentId,
                },
              },
            },
          }
        : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(projectType ? { projectType } : {}),
      ...(priority ? { priority } : {}),
    };

    // Query all matching leads with assigned employee details
    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: {
        id: true,
        leadCode: true,
        title: true,
        status: true,
        source: true,
        projectType: true,
        priority: true,
        estimatedBudget: true,
        budgetInLakh: true,
        assignedToId: true,
        assignedAt: true,
        convertedAt: true,
        lostReason: true,
        lostRemarks: true,
        createdAt: true,
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            departmentAssignments: {
              select: {
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Also fetch all active employees in organization to include all personnel in reports
    const employeesList = await prisma.employee.findMany({
      where: {
        organizationId,
        isDeleted: false,
        employmentStatus: "ACTIVE",
        ...(employeeId ? { id: employeeId } : {}),
        ...(departmentId
          ? {
              departmentAssignments: {
                some: {
                  departmentId,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        designation: true,
        departmentAssignments: {
          select: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    // 1. Overall Summary Calculations
    const totalLeads = leads.length;
    let totalConverted = 0;
    let totalLost = 0;
    let totalInPipeline = 0;
    let totalEstimatedRevenue = 0;
    let convertedRevenue = 0;
    let totalConversionDaysSum = 0;
    let convertedWithDurationCount = 0;

    const statusCounts: Record<string, number> = {};
    const sourceCounts: Record<string, { total: number; converted: number; wonRevenue: number }> = {};
    const lostReasonCounts: Record<string, { count: number; revenue: number }> = {};
    const timeSeriesMap: Record<
      string,
      { period: string; totalLeads: number; convertedLeads: number; lostLeads: number; revenue: number }
    > = {};

    // Grouping by Employee
    const employeeMap: Record<
      string,
      {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        designation: string;
        department: string;
        totalAssignedLeads: number;
        convertedLeads: number;
        lostLeads: number;
        inPipelineLeads: number;
        conversionRate: number;
        totalEstimatedBudget: number;
        wonRevenue: number;
        statusBreakdown: Record<string, number>;
        sourceBreakdown: Record<string, number>;
      }
    > = {};

    // Pre-populate with existing active employees
    employeesList.forEach((emp) => {
      const deptName = emp.departmentAssignments[0]?.department?.name || "CRM & Sales";
      employeeMap[emp.id] = {
        employeeId: emp.id,
        employeeCode: emp.employeeCode,
        employeeName: `${emp.firstName} ${emp.lastName || ""}`.trim(),
        designation: emp.designation || "Sales / Designer",
        department: deptName,
        totalAssignedLeads: 0,
        convertedLeads: 0,
        lostLeads: 0,
        inPipelineLeads: 0,
        conversionRate: 0,
        totalEstimatedBudget: 0,
        wonRevenue: 0,
        statusBreakdown: {},
        sourceBreakdown: {},
      };
    });

    // Process leads
    leads.forEach((lead) => {
      const budgetNum = Number(lead.estimatedBudget || 0);
      totalEstimatedRevenue += budgetNum;

      const isWon = lead.status === "WON" || Boolean(lead.convertedAt);
      const isLost = lead.status === "LOST";
      const isPipeline = !isWon && !isLost && lead.status !== "JUNK" && lead.status !== "NOT_RESPONDING";

      if (isWon) {
        totalConverted++;
        convertedRevenue += budgetNum;

        if (lead.convertedAt && lead.createdAt) {
          const diffMs = new Date(lead.convertedAt).getTime() - new Date(lead.createdAt).getTime();
          const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          totalConversionDaysSum += days;
          convertedWithDurationCount++;
        }
      } else if (isLost) {
        totalLost++;
      } else if (isPipeline) {
        totalInPipeline++;
      }

      // Status distribution
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;

      // Lost Reason distribution
      if (isLost || lead.status === "LOST" || Boolean(lead.lostReason)) {
        const rKey = lead.lostReason || "UNSPECIFIED";
        const currentReason = lostReasonCounts[rKey] || { count: 0, revenue: 0 };
        currentReason.count += 1;
        currentReason.revenue += budgetNum;
        lostReasonCounts[rKey] = currentReason;
      }

      // Source distribution
      const currentSource = sourceCounts[lead.source] || { total: 0, converted: 0, wonRevenue: 0 };
      currentSource.total += 1;
      if (isWon) {
        currentSource.converted += 1;
        currentSource.wonRevenue += budgetNum;
      }
      sourceCounts[lead.source] = currentSource;

      // Time-series bucket calculation
      const dateObj = new Date(lead.createdAt);
      let periodKey = "";
      if (groupBy === "day") {
        periodKey = dateObj.toISOString().split("T")[0] || "";
      } else if (groupBy === "week") {
        const startOfWeek = new Date(dateObj);
        startOfWeek.setDate(dateObj.getDate() - dateObj.getDay());
        periodKey = `W-${startOfWeek.toISOString().split("T")[0] || ""}`;
      } else if (groupBy === "year") {
        periodKey = String(dateObj.getFullYear());
      } else {
        // default month: YYYY-MM
        const monthNum = String(dateObj.getMonth() + 1).padStart(2, "0");
        periodKey = `${dateObj.getFullYear()}-${monthNum}`;
      }

      const currentTimeBucket = timeSeriesMap[periodKey] || {
        period: periodKey,
        totalLeads: 0,
        convertedLeads: 0,
        lostLeads: 0,
        revenue: 0,
      };

      currentTimeBucket.totalLeads += 1;
      if (isWon) {
        currentTimeBucket.convertedLeads += 1;
        currentTimeBucket.revenue += budgetNum;
      } else if (isLost) {
        currentTimeBucket.lostLeads += 1;
      }
      timeSeriesMap[periodKey] = currentTimeBucket;

      // Employee level stats
      if (lead.assignedToId) {
        let e = employeeMap[lead.assignedToId];
        if (!e) {
          const empName = lead.assignedTo
            ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName || ""}`.trim()
            : "Assigned Staff";
          const deptName = lead.assignedTo?.departmentAssignments[0]?.department?.name || "CRM & Sales";

          e = {
            employeeId: lead.assignedToId,
            employeeCode: lead.assignedTo?.employeeCode || "EMP-000",
            employeeName: empName,
            designation: lead.assignedTo?.designation || "Staff",
            department: deptName,
            totalAssignedLeads: 0,
            convertedLeads: 0,
            lostLeads: 0,
            inPipelineLeads: 0,
            conversionRate: 0,
            totalEstimatedBudget: 0,
            wonRevenue: 0,
            statusBreakdown: {},
            sourceBreakdown: {},
          };
          employeeMap[lead.assignedToId] = e;
        }

        e.totalAssignedLeads += 1;
        e.totalEstimatedBudget += budgetNum;

        if (isWon) {
          e.convertedLeads += 1;
          e.wonRevenue += budgetNum;
        } else if (isLost) {
          e.lostLeads += 1;
        } else if (isPipeline) {
          e.inPipelineLeads += 1;
        }

        e.statusBreakdown[lead.status] = (e.statusBreakdown[lead.status] || 0) + 1;
        e.sourceBreakdown[lead.source] = (e.sourceBreakdown[lead.source] || 0) + 1;
      }
    });

    // Compute conversion rate for each employee
    const employeesResult = Object.values(employeeMap)
      .map((emp) => {
        const rate =
          emp.totalAssignedLeads > 0
            ? Math.round((emp.convertedLeads / emp.totalAssignedLeads) * 10000) / 100
            : 0;
        return {
          ...emp,
          conversionRate: rate,
        };
      })
      .sort((a, b) => b.convertedLeads - a.convertedLeads || b.conversionRate - a.conversionRate);

    // Format status distribution for pie chart
    const statusDistribution = Object.entries(statusCounts).map(([stat, count]) => ({
      status: stat,
      count,
      percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 10000) / 100 : 0,
    }));

    // Format source distribution for charts
    const sourceDistribution = Object.entries(sourceCounts).map(([src, item]) => ({
      source: src,
      count: item.total,
      convertedCount: item.converted,
      conversionRate: item.total > 0 ? Math.round((item.converted / item.total) * 10000) / 100 : 0,
      wonRevenue: item.wonRevenue,
    }));

    // Format lost reason distribution
    const totalLostForDistribution =
      totalLost > 0
        ? totalLost
        : Object.values(lostReasonCounts).reduce((acc, v) => acc + v.count, 0);

    const lostReasonDistribution = Object.entries(lostReasonCounts)
      .map(([reason, val]) => ({
        reason,
        count: val.count,
        percentage:
          totalLostForDistribution > 0
            ? Math.round((val.count / totalLostForDistribution) * 10000) / 100
            : 0,
        revenue: val.revenue,
      }))
      .sort((a, b) => b.count - a.count);

    // Format time series list
    const timeSeries = Object.values(timeSeriesMap)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((item) => ({
        ...item,
        conversionRate:
          item.totalLeads > 0 ? Math.round((item.convertedLeads / item.totalLeads) * 10000) / 100 : 0,
      }));

    const overallConversionRate =
      totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 10000) / 100 : 0;

    const avgConversionTimeDays =
      convertedWithDurationCount > 0
        ? Math.round((totalConversionDaysSum / convertedWithDurationCount) * 10) / 10
        : 0;

    return {
      summary: {
        totalLeads,
        convertedLeads: totalConverted,
        lostLeads: totalLost,
        inPipelineLeads: totalInPipeline,
        conversionRate: overallConversionRate,
        totalEstimatedRevenue,
        convertedRevenue,
        averageConversionTimeDays: avgConversionTimeDays,
      },
      employees: employeesResult,
      timeSeries,
      statusDistribution,
      sourceDistribution,
      lostReasonDistribution,
    };
  }

  /**
   * Fetch top performing sales/design personnel ranked by conversions, rate, or revenue
   */
  async getTopPerformers(organizationId: string, query: GetTopPerformersQueryInput) {
    const { startDate, endDate, fromDate, toDate, limit = 10, metric = "conversions", departmentId } = query;

    const effectiveFrom = startDate || fromDate;
    const effectiveTo = endDate || toDate;

    // Fetch leads within date range
    const leads = await prisma.lead.findMany({
      where: {
        organizationId,
        isDeleted: false,
        assignedToId: { not: null },
        ...(effectiveFrom || effectiveTo
          ? {
              createdAt: {
                ...(effectiveFrom
                  ? {
                      gte:
                        effectiveFrom.length === 10
                          ? new Date(`${effectiveFrom}T00:00:00.000Z`)
                          : new Date(effectiveFrom),
                    }
                  : {}),
                ...(effectiveTo
                  ? {
                      lte:
                        effectiveTo.length === 10
                          ? new Date(`${effectiveTo}T23:59:59.999Z`)
                          : new Date(effectiveTo),
                    }
                  : {}),
              },
            }
          : {}),
        ...(departmentId
          ? {
              assignedTo: {
                departmentAssignments: {
                  some: {
                    departmentId,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        estimatedBudget: true,
        assignedToId: true,
        convertedAt: true,
        createdAt: true,
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            departmentAssignments: {
              select: {
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const perfMap: Record<
      string,
      {
        employeeId: string;
        employeeCode: string;
        employeeName: string;
        avatarUrl: any;
        designation: string;
        department: string;
        totalAssigned: number;
        convertedCount: number;
        lostCount: number;
        conversionRate: number;
        totalWonValue: number;
        avgDealSize: number;
        avgClosingDays: number;
        closingDaysSum: number;
        convertedDurationCount: number;
        score: number;
      }
    > = {};

    let orgTotalConverted = 0;
    let orgTotalWonRevenue = 0;
    const orgTotalLeads = leads.length;

    leads.forEach((lead) => {
      const empId = lead.assignedToId!;
      let p = perfMap[empId];
      if (!p) {
        const emp = lead.assignedTo;
        const deptName = emp?.departmentAssignments[0]?.department?.name || "Sales & Design";
        p = {
          employeeId: empId,
          employeeCode: emp?.employeeCode || "EMP-000",
          employeeName: emp ? `${emp.firstName} ${emp.lastName || ""}`.trim() : "Team Member",
          avatarUrl: emp?.avatarUrl || null,
          designation: emp?.designation || "Sales / Designer",
          department: deptName,
          totalAssigned: 0,
          convertedCount: 0,
          lostCount: 0,
          conversionRate: 0,
          totalWonValue: 0,
          avgDealSize: 0,
          avgClosingDays: 0,
          closingDaysSum: 0,
          convertedDurationCount: 0,
          score: 0,
        };
        perfMap[empId] = p;
      }

      const budgetNum = Number(lead.estimatedBudget || 0);
      const isWon = lead.status === "WON" || Boolean(lead.convertedAt);
      const isLost = lead.status === "LOST";

      p.totalAssigned += 1;

      if (isWon) {
        p.convertedCount += 1;
        p.totalWonValue += budgetNum;
        orgTotalConverted += 1;
        orgTotalWonRevenue += budgetNum;

        if (lead.convertedAt && lead.createdAt) {
          const diffMs = new Date(lead.convertedAt).getTime() - new Date(lead.createdAt).getTime();
          const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          p.closingDaysSum += days;
          p.convertedDurationCount += 1;
        }
      } else if (isLost) {
        p.lostCount += 1;
      }
    });

    // Compute aggregates and metric score
    const performers = Object.values(perfMap).map((p) => {
      const rate = p.totalAssigned > 0 ? Math.round((p.convertedCount / p.totalAssigned) * 10000) / 100 : 0;
      const avgDeal = p.convertedCount > 0 ? Math.round(p.totalWonValue / p.convertedCount) : 0;
      const avgDays =
        p.convertedDurationCount > 0 ? Math.round((p.closingDaysSum / p.convertedDurationCount) * 10) / 10 : 0;

      let score = p.convertedCount;
      if (metric === "conversion_rate") {
        score = rate;
      } else if (metric === "revenue") {
        score = p.totalWonValue;
      } else if (metric === "leads_handled") {
        score = p.totalAssigned;
      }

      return {
        employeeId: p.employeeId,
        employeeCode: p.employeeCode,
        employeeName: p.employeeName,
        avatarUrl: p.avatarUrl,
        designation: p.designation,
        department: p.department,
        totalAssigned: p.totalAssigned,
        convertedCount: p.convertedCount,
        lostCount: p.lostCount,
        conversionRate: rate,
        totalWonValue: p.totalWonValue,
        avgDealSize: avgDeal,
        avgClosingDays: avgDays,
        score,
      };
    });

    // Sort by selected metric desc
    performers.sort((a, b) => b.score - a.score || b.convertedCount - a.convertedCount);

    const limitedPerformers = performers.slice(0, limit).map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

    const topRate = limitedPerformers.length > 0 ? Math.max(...limitedPerformers.map((p) => p.conversionRate)) : 0;
    const avgRate = orgTotalLeads > 0 ? Math.round((orgTotalConverted / orgTotalLeads) * 10000) / 100 : 0;

    return {
      period: {
        startDate: effectiveFrom || null,
        endDate: effectiveTo || null,
      },
      metric,
      performers: limitedPerformers,
      rankings: limitedPerformers,
      totalRanked: performers.length,
      benchmarks: {
        topConversionRate: topRate,
        averageConversionRate: avgRate,
        avgConversionRate: avgRate,
        avgWonRevenue: orgTotalWonRevenue,
        totalLeadsAnalyzed: orgTotalLeads,
        totalWonAnalyzed: orgTotalConverted,
        totalOrganizationConverted: orgTotalConverted,
        totalOrganizationRevenue: orgTotalWonRevenue,
      },
      benchmark: {
        topConversionRate: topRate,
        averageConversionRate: avgRate,
        totalOrganizationConverted: orgTotalConverted,
        totalOrganizationRevenue: orgTotalWonRevenue,
      },
    };
  }
}

export const leadReportRepo = new LeadReportRepository();
