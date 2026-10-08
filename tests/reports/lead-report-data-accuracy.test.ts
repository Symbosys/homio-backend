import { describe, it, expect } from "bun:test";

// =========================================================================
// Ground Truth Test Data & Business Computation Verification
// =========================================================================

interface MockLeadEntity {
  id: string;
  leadCode: string;
  title: string;
  status: "NEW_LEAD" | "CONTACTED" | "SITE_VISIT_SCHEDULED" | "PROPOSAL_SENT" | "WON" | "LOST" | "JUNK" | "NOT_RESPONDING";
  source: "WEBSITE" | "META_ADS" | "GOOGLE_ADS" | "REFERRAL" | "CHANNEL_PARTNER";
  estimatedBudget: number;
  assignedToId: string | null;
  assignedAt: Date | null;
  convertedAt: Date | null;
  createdAt: Date;
  assignedTo?: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string | null;
    designation: string | null;
    departmentAssignments: Array<{
      department: {
        id: string;
        name: string;
      };
    }>;
  };
}

interface MockEmployeeEntity {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  designation: string | null;
  departmentAssignments: Array<{
    department: {
      id: string;
      name: string;
    };
  }>;
}

const EMP_ALICE: MockEmployeeEntity = {
  id: "10000000-0000-0000-0000-000000000001",
  employeeCode: "EMP-001",
  firstName: "Alice",
  lastName: "Sharma",
  designation: "Senior Sales Lead",
  departmentAssignments: [{ department: { id: "dept-1", name: "Sales" } }],
};

const EMP_BOB: MockEmployeeEntity = {
  id: "20000000-0000-0000-0000-000000000002",
  employeeCode: "EMP-002",
  firstName: "Bob",
  lastName: "Verma",
  designation: "Interior Consultant",
  departmentAssignments: [{ department: { id: "dept-2", name: "Design & Sales" } }],
};

const EMP_CHARLIE: MockEmployeeEntity = {
  id: "30000000-0000-0000-0000-000000000003",
  employeeCode: "EMP-003",
  firstName: "Charlie",
  lastName: "Patel",
  designation: "Sales Executive",
  departmentAssignments: [{ department: { id: "dept-1", name: "Sales" } }],
};

const MOCK_LEADS: MockLeadEntity[] = [
  // --- Alice's Leads (10 Total: 4 WON, 2 LOST, 3 In Pipeline, 1 JUNK) ---
  {
    id: "lead-a1",
    leadCode: "LD-001",
    title: "Villa Interiors",
    status: "WON",
    source: "META_ADS",
    estimatedBudget: 500000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-01T10:00:00Z"),
    convertedAt: new Date("2026-10-10T10:00:00Z"), // 9 days
    createdAt: new Date("2026-10-01T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a2",
    leadCode: "LD-002",
    title: "Apartment Renovation",
    status: "WON",
    source: "WEBSITE",
    estimatedBudget: 300000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-02T10:00:00Z"),
    convertedAt: new Date("2026-10-07T10:00:00Z"), // 5 days
    createdAt: new Date("2026-10-02T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a3",
    leadCode: "LD-003",
    title: "Penthouse Modular Kitchen",
    status: "WON",
    source: "GOOGLE_ADS",
    estimatedBudget: 250000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-05T10:00:00Z"),
    convertedAt: new Date("2026-10-15T10:00:00Z"), // 10 days
    createdAt: new Date("2026-10-05T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a4",
    leadCode: "LD-004",
    title: "Office Decor",
    status: "WON",
    source: "REFERRAL",
    estimatedBudget: 150000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-09-10T10:00:00Z"),
    convertedAt: new Date("2026-09-20T10:00:00Z"), // 10 days
    createdAt: new Date("2026-09-10T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a5",
    leadCode: "LD-005",
    title: "3BHK Full Furnishing",
    status: "LOST",
    source: "META_ADS",
    estimatedBudget: 600000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-03T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-03T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a6",
    leadCode: "LD-006",
    title: "Studio Apartment",
    status: "LOST",
    source: "WEBSITE",
    estimatedBudget: 200000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-04T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-04T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a7",
    leadCode: "LD-007",
    title: "Duplex Interior",
    status: "PROPOSAL_SENT",
    source: "META_ADS",
    estimatedBudget: 750000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-06T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-06T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a8",
    leadCode: "LD-008",
    title: "Living Room Modern Makeover",
    status: "SITE_VISIT_SCHEDULED",
    source: "GOOGLE_ADS",
    estimatedBudget: 180000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-07T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-07T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a9",
    leadCode: "LD-009",
    title: "Commercial Clinic",
    status: "CONTACTED",
    source: "REFERRAL",
    estimatedBudget: 400000,
    assignedToId: EMP_ALICE.id,
    assignedAt: new Date("2026-10-08T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-08T09:00:00Z"),
    assignedTo: EMP_ALICE,
  },
  {
    id: "lead-a10",
    leadCode: "LD-010",
    title: "Spam Inquiry",
    status: "JUNK",
    source: "WEBSITE",
    estimatedBudget: 0,
    assignedToId: EMP_ALICE.id,
    assignedAt: null,
    convertedAt: null,
    createdAt: new Date("2026-10-08T11:00:00Z"),
    assignedTo: EMP_ALICE,
  },

  // --- Bob's Leads (5 Total: 3 WON, 1 LOST, 1 Pipeline) ---
  {
    id: "lead-b1",
    leadCode: "LD-011",
    title: "Luxury Farmhouse",
    status: "WON",
    source: "CHANNEL_PARTNER",
    estimatedBudget: 1500000,
    assignedToId: EMP_BOB.id,
    assignedAt: new Date("2026-10-01T10:00:00Z"),
    convertedAt: new Date("2026-10-08T10:00:00Z"), // 7 days
    createdAt: new Date("2026-10-01T09:00:00Z"),
    assignedTo: EMP_BOB,
  },
  {
    id: "lead-b2",
    leadCode: "LD-012",
    title: "Boutique Hotel Lobby",
    status: "WON",
    source: "REFERRAL",
    estimatedBudget: 800000,
    assignedToId: EMP_BOB.id,
    assignedAt: new Date("2026-10-03T10:00:00Z"),
    convertedAt: new Date("2026-10-13T10:00:00Z"), // 10 days
    createdAt: new Date("2026-10-03T09:00:00Z"),
    assignedTo: EMP_BOB,
  },
  {
    id: "lead-b3",
    leadCode: "LD-013",
    title: "Corporate HQ Lounge",
    status: "WON",
    source: "WEBSITE",
    estimatedBudget: 450000,
    assignedToId: EMP_BOB.id,
    assignedAt: new Date("2026-09-15T10:00:00Z"),
    convertedAt: new Date("2026-09-22T10:00:00Z"), // 7 days
    createdAt: new Date("2026-09-15T09:00:00Z"),
    assignedTo: EMP_BOB,
  },
  {
    id: "lead-b4",
    leadCode: "LD-014",
    title: "Retail Storefront",
    status: "LOST",
    source: "META_ADS",
    estimatedBudget: 350000,
    assignedToId: EMP_BOB.id,
    assignedAt: new Date("2026-10-05T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-05T09:00:00Z"),
    assignedTo: EMP_BOB,
  },
  {
    id: "lead-b5",
    leadCode: "LD-015",
    title: "Villa Landscape & Interiors",
    status: "PROPOSAL_SENT",
    source: "CHANNEL_PARTNER",
    estimatedBudget: 1200000,
    assignedToId: EMP_BOB.id,
    assignedAt: new Date("2026-10-06T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-06T09:00:00Z"),
    assignedTo: EMP_BOB,
  },

  // --- Charlie's Leads (5 Total: 1 WON, 3 LOST, 1 Pipeline) ---
  {
    id: "lead-c1",
    leadCode: "LD-016",
    title: "2BHK Renovation",
    status: "WON",
    source: "WEBSITE",
    estimatedBudget: 300000,
    assignedToId: EMP_CHARLIE.id,
    assignedAt: new Date("2026-10-02T10:00:00Z"),
    convertedAt: new Date("2026-10-18T10:00:00Z"), // 16 days
    createdAt: new Date("2026-10-02T09:00:00Z"),
    assignedTo: EMP_CHARLIE,
  },
  {
    id: "lead-c2",
    leadCode: "LD-017",
    title: "Budget Flat",
    status: "LOST",
    source: "META_ADS",
    estimatedBudget: 150000,
    assignedToId: EMP_CHARLIE.id,
    assignedAt: new Date("2026-10-03T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-03T09:00:00Z"),
    assignedTo: EMP_CHARLIE,
  },
  {
    id: "lead-c3",
    leadCode: "LD-018",
    title: "Rental Touchup",
    status: "LOST",
    source: "GOOGLE_ADS",
    estimatedBudget: 80000,
    assignedToId: EMP_CHARLIE.id,
    assignedAt: new Date("2026-10-04T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-04T09:00:00Z"),
    assignedTo: EMP_CHARLIE,
  },
  {
    id: "lead-c4",
    leadCode: "LD-019",
    title: "Single Room Makeover",
    status: "LOST",
    source: "META_ADS",
    estimatedBudget: 60000,
    assignedToId: EMP_CHARLIE.id,
    assignedAt: new Date("2026-10-05T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-05T09:00:00Z"),
    assignedTo: EMP_CHARLIE,
  },
  {
    id: "lead-c5",
    leadCode: "LD-020",
    title: "4BHK Premium Flat",
    status: "CONTACTED",
    source: "REFERRAL",
    estimatedBudget: 850000,
    assignedToId: EMP_CHARLIE.id,
    assignedAt: new Date("2026-10-07T10:00:00Z"),
    convertedAt: null,
    createdAt: new Date("2026-10-07T09:00:00Z"),
    assignedTo: EMP_CHARLIE,
  },
];

// =========================================================================
// Business Logic Engine Functions
// =========================================================================

function calculateLeadReportSummary(leads: MockLeadEntity[]) {
  const totalLeads = leads.length;
  let totalConverted = 0;
  let totalLost = 0;
  let totalInPipeline = 0;
  let totalEstimatedRevenue = 0;
  let convertedRevenue = 0;
  let totalConversionDaysSum = 0;
  let convertedWithDurationCount = 0;

  leads.forEach((l) => {
    const budget = l.estimatedBudget || 0;
    totalEstimatedRevenue += budget;

    const isWon = l.status === "WON" || Boolean(l.convertedAt);
    const isLost = l.status === "LOST";
    const isPipeline = !isWon && !isLost && l.status !== "JUNK" && l.status !== "NOT_RESPONDING";

    if (isWon) {
      totalConverted++;
      convertedRevenue += budget;

      if (l.convertedAt && l.createdAt) {
        const diffMs = l.convertedAt.getTime() - l.createdAt.getTime();
        const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        totalConversionDaysSum += days;
        convertedWithDurationCount++;
      }
    } else if (isLost) {
      totalLost++;
    } else if (isPipeline) {
      totalInPipeline++;
    }
  });

  const overallConversionRate =
    totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 10000) / 100 : 0;
  const avgConversionDurationDays =
    convertedWithDurationCount > 0
      ? Math.round((totalConversionDaysSum / convertedWithDurationCount) * 10) / 10
      : 0;

  return {
    totalLeads,
    totalConverted,
    totalLost,
    totalInPipeline,
    overallConversionRate,
    totalEstimatedRevenue,
    convertedRevenue,
    avgConversionDurationDays,
  };
}

function calculateEmployeeBreakdown(leads: MockLeadEntity[], employees: MockEmployeeEntity[]) {
  const employeeMap: Record<
    string,
    {
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      totalAssignedLeads: number;
      convertedLeads: number;
      lostLeads: number;
      inPipelineLeads: number;
      conversionRate: number;
      wonRevenue: number;
    }
  > = {};

  employees.forEach((emp) => {
    employeeMap[emp.id] = {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName || ""}`.trim(),
      totalAssignedLeads: 0,
      convertedLeads: 0,
      lostLeads: 0,
      inPipelineLeads: 0,
      conversionRate: 0,
      wonRevenue: 0,
    };
  });

  leads.forEach((l) => {
    if (l.assignedToId && employeeMap[l.assignedToId]) {
      const e = employeeMap[l.assignedToId]!;
      e.totalAssignedLeads++;

      const isWon = l.status === "WON" || Boolean(l.convertedAt);
      const isLost = l.status === "LOST";
      const isPipeline = !isWon && !isLost && l.status !== "JUNK" && l.status !== "NOT_RESPONDING";

      if (isWon) {
        e.convertedLeads++;
        e.wonRevenue += l.estimatedBudget;
      } else if (isLost) {
        e.lostLeads++;
      } else if (isPipeline) {
        e.inPipelineLeads++;
      }
    }
  });

  Object.values(employeeMap).forEach((e) => {
    e.conversionRate =
      e.totalAssignedLeads > 0
        ? Math.round((e.convertedLeads / e.totalAssignedLeads) * 10000) / 100
        : 0;
  });

  return employeeMap;
}

function rankTopPerformers(
  leads: MockLeadEntity[],
  metric: "conversions" | "conversion_rate" | "revenue" | "leads_handled"
) {
  const map: Record<
    string,
    {
      employeeId: string;
      name: string;
      totalAssigned: number;
      convertedCount: number;
      lostCount: number;
      conversionRate: number;
      totalWonValue: number;
      score: number;
    }
  > = {};

  leads.forEach((l) => {
    if (!l.assignedToId) return;
    if (!map[l.assignedToId]) {
      const name = l.assignedTo
        ? `${l.assignedTo.firstName} ${l.assignedTo.lastName || ""}`.trim()
        : "Staff";
      map[l.assignedToId] = {
        employeeId: l.assignedToId,
        name,
        totalAssigned: 0,
        convertedCount: 0,
        lostCount: 0,
        conversionRate: 0,
        totalWonValue: 0,
        score: 0,
      };
    }

    const item = map[l.assignedToId]!;
    item.totalAssigned++;

    const isWon = l.status === "WON" || Boolean(l.convertedAt);
    if (isWon) {
      item.convertedCount++;
      item.totalWonValue += l.estimatedBudget;
    } else if (l.status === "LOST") {
      item.lostCount++;
    }
  });

  Object.values(map).forEach((p) => {
    p.conversionRate =
      p.totalAssigned > 0 ? Math.round((p.convertedCount / p.totalAssigned) * 10000) / 100 : 0;

    if (metric === "conversion_rate") {
      p.score = p.conversionRate;
    } else if (metric === "revenue") {
      p.score = p.totalWonValue;
    } else if (metric === "leads_handled") {
      p.score = p.totalAssigned;
    } else {
      p.score = p.convertedCount;
    }
  });

  const ranked = Object.values(map).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.convertedCount - a.convertedCount;
  });

  return ranked.map((r, idx) => ({ ...r, rank: idx + 1 }));
}

// =========================================================================
// Automated Data Accuracy Test Suite
// =========================================================================

describe("Lead Conversion & Employee Report 100% Data Accuracy Tests", () => {
  const employees = [EMP_ALICE, EMP_BOB, EMP_CHARLIE];

  it("should calculate exact overall organizational summary metrics without discrepancies", () => {
    const summary = calculateLeadReportSummary(MOCK_LEADS);

    // Ground Truth checks:
    // Total Leads = 20
    expect(summary.totalLeads).toBe(20);

    // Won Leads: Alice (4) + Bob (3) + Charlie (1) = 8
    expect(summary.totalConverted).toBe(8);

    // Lost Leads: Alice (2) + Bob (1) + Charlie (3) = 6
    expect(summary.totalLost).toBe(6);

    // In Pipeline: Alice (3) + Bob (1) + Charlie (1) = 5 (excluding 1 JUNK)
    expect(summary.totalInPipeline).toBe(5);

    // Conversion Rate: 8 / 20 = 40.0%
    expect(summary.overallConversionRate).toBe(40.0);

    // Won Revenue:
    // Alice won: 500k + 300k + 250k + 150k = 1,200,000
    // Bob won: 1,500,000 + 800k + 450k = 2,750,000
    // Charlie won: 300k
    // Total Won Revenue = 1,200,000 + 2,750,000 + 300,000 = 4,250,000
    expect(summary.convertedRevenue).toBe(4250000);

    // Total Estimated Revenue:
    // Alice total = 3,330,000
    // Bob total = 4,300,000
    // Charlie total = 1,440,000
    // Total = 9,070,000
    expect(summary.totalEstimatedRevenue).toBe(9070000);

    // Avg Conversion Duration:
    // Alice durations: 9, 5, 10, 10 = 34 days
    // Bob durations: 7, 10, 7 = 24 days
    // Charlie durations: 16 = 16 days
    // Total = 74 days / 8 won leads = 9.25 -> 9.3 days
    expect(summary.avgConversionDurationDays).toBe(9.3);
  });

  it("should accurately isolate metrics when filtering by individual employee (Alice)", () => {
    const aliceLeads = MOCK_LEADS.filter((l) => l.assignedToId === EMP_ALICE.id);
    const aliceSummary = calculateLeadReportSummary(aliceLeads);

    expect(aliceSummary.totalLeads).toBe(10);
    expect(aliceSummary.totalConverted).toBe(4);
    expect(aliceSummary.totalLost).toBe(2);
    expect(aliceSummary.totalInPipeline).toBe(3);
    expect(aliceSummary.overallConversionRate).toBe(40.0);
    expect(aliceSummary.convertedRevenue).toBe(1200000);
  });

  it("should accurately isolate metrics when filtering by individual employee (Bob)", () => {
    const bobLeads = MOCK_LEADS.filter((l) => l.assignedToId === EMP_BOB.id);
    const bobSummary = calculateLeadReportSummary(bobLeads);

    expect(bobSummary.totalLeads).toBe(5);
    expect(bobSummary.totalConverted).toBe(3);
    expect(bobSummary.totalLost).toBe(1);
    expect(bobSummary.totalInPipeline).toBe(1);
    expect(bobSummary.overallConversionRate).toBe(60.0);
    expect(bobSummary.convertedRevenue).toBe(2750000);
  });

  it("should accurately calculate per-employee matrix performance breakdown", () => {
    const breakdown = calculateEmployeeBreakdown(MOCK_LEADS, employees);

    const alice = breakdown[EMP_ALICE.id]!;
    expect(alice.employeeName).toBe("Alice Sharma");
    expect(alice.totalAssignedLeads).toBe(10);
    expect(alice.convertedLeads).toBe(4);
    expect(alice.lostLeads).toBe(2);
    expect(alice.inPipelineLeads).toBe(3);
    expect(alice.conversionRate).toBe(40.0);
    expect(alice.wonRevenue).toBe(1200000);

    const bob = breakdown[EMP_BOB.id]!;
    expect(bob.employeeName).toBe("Bob Verma");
    expect(bob.totalAssignedLeads).toBe(5);
    expect(bob.convertedLeads).toBe(3);
    expect(bob.conversionRate).toBe(60.0);
    expect(bob.wonRevenue).toBe(2750000);

    const charlie = breakdown[EMP_CHARLIE.id]!;
    expect(charlie.employeeName).toBe("Charlie Patel");
    expect(charlie.totalAssignedLeads).toBe(5);
    expect(charlie.convertedLeads).toBe(1);
    expect(charlie.lostLeads).toBe(3);
    expect(charlie.conversionRate).toBe(20.0);
    expect(charlie.wonRevenue).toBe(300000);
  });

  it("should correctly rank Top Performers when sorted by Total Conversions", () => {
    const rankedByConversions = rankTopPerformers(MOCK_LEADS, "conversions");

    expect(rankedByConversions[0]!.rank).toBe(1);
    expect(rankedByConversions[0]!.name).toBe("Alice Sharma");
    expect(rankedByConversions[0]!.convertedCount).toBe(4);

    expect(rankedByConversions[1]!.rank).toBe(2);
    expect(rankedByConversions[1]!.name).toBe("Bob Verma");
    expect(rankedByConversions[1]!.convertedCount).toBe(3);

    expect(rankedByConversions[2]!.rank).toBe(3);
    expect(rankedByConversions[2]!.name).toBe("Charlie Patel");
    expect(rankedByConversions[2]!.convertedCount).toBe(1);
  });

  it("should correctly rank Top Performers when sorted by Won Revenue", () => {
    const rankedByRevenue = rankTopPerformers(MOCK_LEADS, "revenue");

    expect(rankedByRevenue[0]!.rank).toBe(1);
    expect(rankedByRevenue[0]!.name).toBe("Bob Verma");
    expect(rankedByRevenue[0]!.totalWonValue).toBe(2750000);

    expect(rankedByRevenue[1]!.rank).toBe(2);
    expect(rankedByRevenue[1]!.name).toBe("Alice Sharma");
    expect(rankedByRevenue[1]!.totalWonValue).toBe(1200000);

    expect(rankedByRevenue[2]!.rank).toBe(3);
    expect(rankedByRevenue[2]!.name).toBe("Charlie Patel");
    expect(rankedByRevenue[2]!.totalWonValue).toBe(300000);
  });

  it("should correctly rank Top Performers when sorted by Conversion Rate (%)", () => {
    const rankedByRate = rankTopPerformers(MOCK_LEADS, "conversion_rate");

    expect(rankedByRate[0]!.rank).toBe(1);
    expect(rankedByRate[0]!.name).toBe("Bob Verma");
    expect(rankedByRate[0]!.conversionRate).toBe(60.0);

    expect(rankedByRate[1]!.rank).toBe(2);
    expect(rankedByRate[1]!.name).toBe("Alice Sharma");
    expect(rankedByRate[1]!.conversionRate).toBe(40.0);

    expect(rankedByRate[2]!.rank).toBe(3);
    expect(rankedByRate[2]!.name).toBe("Charlie Patel");
    expect(rankedByRate[2]!.conversionRate).toBe(20.0);
  });

  it("should ensure pipeline stage distribution counts sum exactly to total leads", () => {
    const statusCounts: Record<string, number> = {};
    MOCK_LEADS.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    });

    const sumOfStages = Object.values(statusCounts).reduce((acc, c) => acc + c, 0);
    expect(sumOfStages).toBe(MOCK_LEADS.length);
    expect(statusCounts["WON"]).toBe(8);
    expect(statusCounts["LOST"]).toBe(6);
    expect(statusCounts["JUNK"]).toBe(1);
    expect(statusCounts["PROPOSAL_SENT"]).toBe(2);
    expect(statusCounts["CONTACTED"]).toBe(2);
    expect(statusCounts["SITE_VISIT_SCHEDULED"]).toBe(1);
  });

  it("should ensure acquisition source channel conversion totals match channel records", () => {
    const sourceMap: Record<string, { total: number; converted: number; revenue: number }> = {};
    MOCK_LEADS.forEach((l) => {
      if (!sourceMap[l.source]) {
        sourceMap[l.source] = { total: 0, converted: 0, revenue: 0 };
      }
      const s = sourceMap[l.source]!;
      s.total++;
      if (l.status === "WON") {
        s.converted++;
        s.revenue += l.estimatedBudget;
      }
    });

    expect(sourceMap["WEBSITE"]!.total).toBe(5);
    expect(sourceMap["WEBSITE"]!.converted).toBe(3); // a2, b3, c1
    expect(sourceMap["WEBSITE"]!.revenue).toBe(300000 + 450000 + 300000);

    expect(sourceMap["META_ADS"]!.total).toBe(6);
    expect(sourceMap["META_ADS"]!.converted).toBe(1); // a1

    expect(sourceMap["CHANNEL_PARTNER"]!.total).toBe(2);
    expect(sourceMap["CHANNEL_PARTNER"]!.converted).toBe(1); // b1 (1.5M)
  });
});
