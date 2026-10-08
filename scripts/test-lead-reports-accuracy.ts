/**
 * Lead Reports & Analytics 100% Accuracy Verification Suite
 * 
 * Verifies that the Lead Performance Report and Top Performers Leaderboard
 * calculate with 100% mathematical precision across all dimensions,
 * status filters, source distributions, time-series intervals, and employee metrics.
 * 
 * Execution:
 *   bun run scripts/test-lead-reports-accuracy.ts
 */

import { prisma } from "../src/lib/prisma.js";
import { leadReportService } from "../src/module/reports/services/lead-report.service.js";

// ANSI color formatters for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assertEqual<T>(actual: T, expected: T, testName: string, detail?: string) {
  totalAssertions++;
  if (actual === expected) {
    passedAssertions++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} [${testName}] => ${colors.cyan}${actual}${colors.reset}`);
  } else {
    failedAssertions++;
    console.error(
      `  ${colors.red}✘ FAIL${colors.reset} [${testName}]\n` +
      `    Expected: ${colors.green}${expected}${colors.reset}\n` +
      `    Actual:   ${colors.red}${actual}${colors.reset}\n` +
      (detail ? `    Details:  ${detail}\n` : "")
    );
  }
}

function assertWithinDelta(actual: number, expected: number, delta: number, testName: string) {
  totalAssertions++;
  const diff = Math.abs(actual - expected);
  if (diff <= delta) {
    passedAssertions++;
    console.log(`  ${colors.green}✔ PASS${colors.reset} [${testName}] => ${colors.cyan}${actual}${colors.reset} (diff: ${diff.toFixed(2)})`);
  } else {
    failedAssertions++;
    console.error(
      `  ${colors.red}✘ FAIL${colors.reset} [${testName}]\n` +
      `    Expected: ${colors.green}${expected}${colors.reset} (±${delta})\n` +
      `    Actual:   ${colors.red}${actual}${colors.reset} (diff: ${diff})`
    );
  }
}

async function runLeadAccuracyVerification() {
  console.log(`\n${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}   LEAD REPORTS & CONVERSION ANALYTICS - 100% ACCURACY VERIFICATION${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}\n`);

  // 1. Locate Organizations in Database
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    take: 5,
  });

  if (organizations.length === 0) {
    console.log(`${colors.yellow}No organizations found in database. Exiting...${colors.reset}`);
    return;
  }

  for (const org of organizations) {
    console.log(`\n${colors.bold}${colors.blue}🏢 Verifying Lead Analytics for Org: ${org.name} (${org.id})${colors.reset}\n`);

    // ---------------------------------------------------------------------------------
    // TEST SECTION 1: ALL-TIME BASELINE RAW DB TRUTH vs SERVICE SUMMARY
    // ---------------------------------------------------------------------------------
    console.log(`${colors.bold}--- [1] Lead Performance Summary vs Raw Database Ground Truth ---${colors.reset}`);

    const perfReport = await leadReportService.getEmployeePerformance(org.id, {
      groupBy: "month",
    });

    const rawLeads = await prisma.lead.findMany({
      where: {
        organizationId: org.id,
        isDeleted: false,
      },
    });

    const rawTotalLeads = rawLeads.length;
    let rawTotalConverted = 0;
    let rawTotalLost = 0;
    let rawTotalPipeline = 0;
    let rawEstimatedRevenue = 0;
    let rawConvertedRevenue = 0;
    let rawTotalConversionDays = 0;
    let rawConvertedDurationCount = 0;

    for (const lead of rawLeads) {
      const budget = Number(lead.estimatedBudget || 0);
      rawEstimatedRevenue += budget;

      const isWon = lead.status === "WON" || Boolean(lead.convertedAt);
      const isLost = lead.status === "LOST";
      const isPipeline = !isWon && !isLost && lead.status !== "JUNK" && lead.status !== "NOT_RESPONDING";

      if (isWon) {
        rawTotalConverted++;
        rawConvertedRevenue += budget;

        if (lead.convertedAt && lead.createdAt) {
          const diffMs = new Date(lead.convertedAt).getTime() - new Date(lead.createdAt).getTime();
          const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
          rawTotalConversionDays += days;
          rawConvertedDurationCount++;
        }
      } else if (isLost) {
        rawTotalLost++;
      } else if (isPipeline) {
        rawTotalPipeline++;
      }
    }

    const rawConversionRate = rawTotalLeads > 0 ? Math.round((rawTotalConverted / rawTotalLeads) * 10000) / 100 : 0;
    const rawAvgDuration = rawConvertedDurationCount > 0 ? Math.round((rawTotalConversionDays / rawConvertedDurationCount) * 10) / 10 : 0;

    assertEqual(perfReport.summary.totalLeads, rawTotalLeads, "Summary: Total Leads Count");
    assertEqual(perfReport.summary.convertedLeads, rawTotalConverted, "Summary: Total Won / Converted Deals");
    assertEqual(perfReport.summary.lostLeads, rawTotalLost, "Summary: Total Lost Leads");
    assertEqual(perfReport.summary.inPipelineLeads, rawTotalPipeline, "Summary: In Pipeline Count");
    assertWithinDelta(perfReport.summary.conversionRate, rawConversionRate, 0.01, "Summary: Overall Conversion Win Rate (%)");
    assertWithinDelta(perfReport.summary.totalEstimatedRevenue, rawEstimatedRevenue, 1, "Summary: Total Estimated Pipeline Revenue");
    assertWithinDelta(perfReport.summary.convertedRevenue, rawConvertedRevenue, 1, "Summary: Converted Won Revenue");
    assertWithinDelta(perfReport.summary.averageConversionTimeDays, rawAvgDuration, 0.1, "Summary: Average Days to Convert");

    // ---------------------------------------------------------------------------------
    // TEST SECTION 2: CONSERVATION LAWS ACROSS DISTRIBUTIONS & TIME SERIES
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [2] Mathematical Conservation Laws (Distributions & Series) ---${colors.reset}`);

    // Status Distribution sum must equal total leads
    const sumStatusCounts = perfReport.statusDistribution.reduce((acc, s) => acc + s.count, 0);
    assertEqual(sumStatusCounts, rawTotalLeads, "Status Distribution: Sum of all status buckets equals total leads");

    // Source Distribution sum must equal total leads
    const sumSourceCounts = perfReport.sourceDistribution.reduce((acc, s) => acc + s.count, 0);
    assertEqual(sumSourceCounts, rawTotalLeads, "Source Distribution: Sum of all acquisition sources equals total leads");

    // Time-series total leads and converted sum conservation
    const sumTimeSeriesTotal = perfReport.timeSeries.reduce((acc, t) => acc + t.totalLeads, 0);
    const sumTimeSeriesWon = perfReport.timeSeries.reduce((acc, t) => acc + t.convertedLeads, 0);
    assertEqual(sumTimeSeriesTotal, rawTotalLeads, "Time Series: Sum of periodic total leads matches total leads");
    assertEqual(sumTimeSeriesWon, rawTotalConverted, "Time Series: Sum of periodic converted leads matches total converted");

    // Lost Reasons distribution verification
    const rawLostLeads = rawLeads.filter((l) => l.status === "LOST" || Boolean(l.lostReason));
    const rawLostReasonCounts: Record<string, number> = {};
    for (const l of rawLostLeads) {
      const reason = l.lostReason || "UNSPECIFIED";
      rawLostReasonCounts[reason] = (rawLostReasonCounts[reason] || 0) + 1;
    }

    const perfLostReasons = perfReport.lostReasonDistribution || [];
    const sumLostReasonCounts = perfLostReasons.reduce((acc, r) => acc + r.count, 0);
    assertEqual(
      sumLostReasonCounts,
      rawLostLeads.length,
      "Lost Reason Distribution: Total lost reason count matches total lost leads"
    );

    for (const item of perfLostReasons) {
      const expectedCount = rawLostReasonCounts[item.reason] || 0;
      assertEqual(
        item.count,
        expectedCount,
        `Lost Reason [${item.reason}]: Exact count matches database ground truth`
      );

      const expectedPct = rawLostLeads.length > 0
        ? Math.round((expectedCount / rawLostLeads.length) * 1000) / 10
        : 0;
      assertWithinDelta(
        item.percentage,
        expectedPct,
        0.1,
        `Lost Reason [${item.reason}]: Percentage (${item.percentage}%) matches exact formula`
      );
    }

    // ---------------------------------------------------------------------------------
    // TEST SECTION 3: TOP PERFORMERS LEADERBOARD ACCURACY
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [3] Top Performers Leaderboard Verification ---${colors.reset}`);

    const leaderboardConversions = await leadReportService.getTopPerformers(org.id, {
      metric: "conversions",
      limit: 50,
    });

    const performers = leaderboardConversions.performers || [];
    console.log(`  Found ${performers.length} ranked personnel on conversions leaderboard`);

    if (performers.length > 1) {
      // 1. Strictly non-increasing order by converted leads
      const isSortedConversions = performers.every((p, idx, arr) => {
        return idx === 0 || arr[idx - 1]!.convertedCount >= p.convertedCount;
      });
      assertEqual(isSortedConversions, true, "Leaderboard: Ranked strictly descending by converted leads");

      // 2. Rank sequence correctness (1, 2, 3...)
      const ranksContinuous = performers.every((p, idx) => p.rank === idx + 1);
      assertEqual(ranksContinuous, true, "Leaderboard: Sequential continuous ranks assigned");
    }

    // Leaderboard sorted by Revenue
    const leaderboardRevenue = await leadReportService.getTopPerformers(org.id, {
      metric: "revenue",
      limit: 50,
    });

    const revenuePerformers = leaderboardRevenue.performers || [];
    if (revenuePerformers.length > 1) {
      const isSortedRevenue = revenuePerformers.every((p, idx, arr) => {
        return idx === 0 || arr[idx - 1]!.totalWonValue >= p.totalWonValue;
      });
      assertEqual(isSortedRevenue, true, "Leaderboard: Ranked strictly descending by won revenue");
    }

    // ---------------------------------------------------------------------------------
    // TEST SECTION 4: EMPLOYEE ISOLATION DRILL-DOWN FILTER ACCURACY
    // ---------------------------------------------------------------------------------
    console.log(`\n${colors.bold}--- [4] Individual Employee Drill-Down Filter Accuracy ---${colors.reset}`);

    const assignedLead = await prisma.lead.findFirst({
      where: {
        organizationId: org.id,
        isDeleted: false,
        assignedToId: { not: null },
      },
      select: { assignedToId: true },
    });

    if (assignedLead?.assignedToId) {
      const targetEmpId = assignedLead.assignedToId;
      const empFilteredReport = await leadReportService.getEmployeePerformance(org.id, {
        employeeId: targetEmpId,
      });

      const empRawLeads = await prisma.lead.findMany({
        where: {
          organizationId: org.id,
          isDeleted: false,
          assignedToId: targetEmpId,
        },
      });

      const empRawWon = empRawLeads.filter((l) => l.status === "WON" || Boolean(l.convertedAt)).length;

      assertEqual(
        empFilteredReport.summary.totalLeads,
        empRawLeads.length,
        `Employee Filter [${targetEmpId}]: Total Leads accurately scoped`
      );
      assertEqual(
        empFilteredReport.summary.convertedLeads,
        empRawWon,
        `Employee Filter [${targetEmpId}]: Won Deals accurately scoped`
      );
    }
  }

  // ---------------------------------------------------------------------------------
  // FINAL SCORE & SUMMARY
  // ---------------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`${colors.bold}                 LEAD ACCURACY SUITE SUMMARY RESULTS${colors.reset}`);
  console.log(`${colors.bold}${colors.magenta}========================================================================${colors.reset}`);
  console.log(`  Total Assertions Tested: ${colors.bold}${totalAssertions}${colors.reset}`);
  console.log(`  Passed:                 ${colors.green}${colors.bold}${passedAssertions}${colors.reset}`);
  console.log(`  Failed:                 ${failedAssertions > 0 ? colors.red : colors.green}${colors.bold}${failedAssertions}${colors.reset}`);
  console.log(`  Overall Accuracy Score: ${colors.bold}${((passedAssertions / (totalAssertions || 1)) * 100).toFixed(2)}%${colors.reset}\n`);

  if (failedAssertions === 0) {
    console.log(`${colors.green}${colors.bold}🌟 SUCCESS: Lead Reports API & Engine Calculations are 100% ACCURATE in every aspect!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bold}❌ ACCURACY CHECK FAILED: Found ${failedAssertions} discrepancies.${colors.reset}\n`);
    process.exit(1);
  }
}

// Execute script
runLeadAccuracyVerification().catch((err) => {
  console.error(`${colors.red}Fatal execution error in lead accuracy verification script:${colors.reset}`, err);
  process.exit(1);
});
