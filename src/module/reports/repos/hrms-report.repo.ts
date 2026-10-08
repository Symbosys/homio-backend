import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetHrmsReportQueryInput,
  GetHrmsIncentivesReportQueryInput,
} from "../validators/hrms-report.validator.js";

export class HrmsReportsRepository {
  /**
   * Helper: Resolve start & end Date objects from filters or preset
   */
  resolveDateRange(filters: {
    startDate?: string;
    endDate?: string;
    fromDate?: string;
    toDate?: string;
    year?: number;
    preset?: string;
  }): { startDate?: Date; endDate?: Date } {
    const now = new Date();

    if (filters.preset) {
      if (filters.preset === "this_month") {
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        return { startDate: start, endDate: end };
      }
      if (filters.preset === "last_month") {
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1));
        const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
        return { startDate: start, endDate: end };
      }
      if (filters.preset === "last_3_months") {
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 3, 1));
        const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        return { startDate: start, endDate: end };
      }
      if (filters.preset === "last_6_months") {
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 6, 1));
        const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        return { startDate: start, endDate: end };
      }
      if (filters.preset === "this_year") {
        const start = new Date(Date.UTC(now.getFullYear(), 0, 1));
        const end = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59, 999));
        return { startDate: start, endDate: end };
      }
      if (filters.preset === "all_time") {
        return {};
      }
    }

    if (filters.year) {
      const start = new Date(Date.UTC(filters.year, 0, 1));
      const end = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
      return { startDate: start, endDate: end };
    }

    const startRaw = filters.startDate || filters.fromDate;
    const endRaw = filters.endDate || filters.toDate;

    return {
      startDate: startRaw ? new Date(startRaw.includes("T") ? startRaw : `${startRaw}T00:00:00.000Z`) : undefined,
      endDate: endRaw ? new Date(endRaw.includes("T") ? endRaw : `${endRaw}T23:59:59.999Z`) : undefined,
    };
  }

  /**
   * Fetch aggregate payroll records and distributions
   */
  async getPayrollMetrics(organizationId: string, filters: GetHrmsReportQueryInput) {
    const { startDate, endDate } = this.resolveDateRange(filters);

    const recordWhere: Prisma.PayrollRecordWhereInput = {
      payrollPeriod: {
        organizationId,
        isDeleted: false,
        ...(filters.payrollPeriodId && { id: filters.payrollPeriodId }),
        ...(filters.status && { status: filters.status }),
        ...(startDate && { startDate: { gte: startDate } }),
        ...(endDate && { endDate: { lte: endDate } }),
      },
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...(filters.departmentId && {
        employee: {
          departmentAssignments: {
            some: { departmentId: filters.departmentId },
          },
        },
      }),
    };

    const records = await prisma.payrollRecord.findMany({
      where: recordWhere,
      include: {
        payrollPeriod: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            departmentAssignments: {
              include: { department: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Summary counters
    let totalGrossPay = 0;
    let totalNetDisbursed = 0;
    let totalStatutoryDeductions = 0;
    let totalPaidDays = 0;
    let totalCycleDays = 0;

    const monthlyMap = new Map<string, {
      monthKey: string;
      monthName: string;
      year: number;
      month: number;
      grossPay: number;
      netPay: number;
      deductions: number;
      employeeCount: Set<string>;
    }>();

    const departmentMap = new Map<string, {
      departmentId: string;
      departmentName: string;
      totalGross: number;
      totalNet: number;
      employeeIds: Set<string>;
    }>();

    const statusMap = new Map<string, { count: number; totalAmount: number }>();

    for (const r of records) {
      const gross = Number(r.grossEarnings);
      const net = Number(r.netPay);
      const deductions = Number(r.totalDeductions);
      const present = Number(r.presentDays);
      const working = r.workingDays;

      totalGrossPay += gross;
      totalNetDisbursed += net;
      totalStatutoryDeductions += deductions;
      totalPaidDays += present;
      totalCycleDays += working;

      // Status aggregation
      const pStatus = r.paymentStatus || "PENDING";
      const existingStatus = statusMap.get(pStatus) || { count: 0, totalAmount: 0 };
      existingStatus.count += 1;
      existingStatus.totalAmount += net;
      statusMap.set(pStatus, existingStatus);

      // Monthly Trend Aggregation
      const period = r.payrollPeriod;
      if (period) {
        const monthKey = `${period.year}-${String(period.month).padStart(2, "0")}`;
        const monthName = new Date(period.year, period.month - 1, 1).toLocaleString("en-US", {
          month: "short",
        });

        const existingMonth = monthlyMap.get(monthKey) || {
          monthKey,
          monthName: `${monthName} ${period.year}`,
          year: period.year,
          month: period.month,
          grossPay: 0,
          netPay: 0,
          deductions: 0,
          employeeCount: new Set<string>(),
        };

        existingMonth.grossPay += gross;
        existingMonth.netPay += net;
        existingMonth.deductions += deductions;
        existingMonth.employeeCount.add(r.employeeId);
        monthlyMap.set(monthKey, existingMonth);
      }

      // Department distribution
      const depts = r.employee?.departmentAssignments || [];
      const firstDept = depts[0];
      const deptName = firstDept?.department?.name ? firstDept.department.name : "General / Operations";
      const deptId = firstDept?.departmentId ? firstDept.departmentId : "general";

      const existingDept = departmentMap.get(deptId) || {
        departmentId: deptId,
        departmentName: deptName,
        totalGross: 0,
        totalNet: 0,
        employeeIds: new Set<string>(),
      };

      existingDept.totalGross += gross;
      existingDept.totalNet += net;
      existingDept.employeeIds.add(r.employeeId);
      departmentMap.set(deptId, existingDept);
    }

    const monthlyTrends = Array.from(monthlyMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => ({
        monthKey: m.monthKey,
        monthName: m.monthName,
        year: m.year,
        month: m.month,
        grossPay: Math.round(m.grossPay),
        netPay: Math.round(m.netPay),
        deductions: Math.round(m.deductions),
        employeeCount: m.employeeCount.size,
      }));

    const departmentPayrollDistribution = Array.from(departmentMap.values()).map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
      totalGross: Math.round(d.totalGross),
      totalNet: Math.round(d.totalNet),
      employeeCount: d.employeeIds.size,
      percentage: totalNetDisbursed > 0 ? Math.round((d.totalNet / totalNetDisbursed) * 1000) / 10 : 0,
    }));

    const statusDistribution = Array.from(statusMap.entries()).map(([status, val]) => ({
      status,
      count: val.count,
      totalAmount: Math.round(val.totalAmount),
    }));

    return {
      totalGrossPay: Math.round(totalGrossPay),
      totalNetDisbursed: Math.round(totalNetDisbursed),
      totalStatutoryDeductions: Math.round(totalStatutoryDeductions),
      totalRecords: records.length,
      averageNetSalary: records.length > 0 ? Math.round(totalNetDisbursed / records.length) : 0,
      monthlyTrends,
      departmentPayrollDistribution,
      statusDistribution,
    };
  }

  /**
   * Fetch employee incentives metrics and distributions
   */
  async getIncentivesMetrics(
    organizationId: string,
    filters: GetHrmsIncentivesReportQueryInput
  ) {
    const { startDate, endDate } = this.resolveDateRange(filters);

    const where: Prisma.EmployeeIncentiveWhereInput = {
      employee: {
        organizationId,
        isDeleted: false,
        ...(filters.departmentId && {
          departmentAssignments: {
            some: {
              departmentId: filters.departmentId,
            },
          },
        }),
      },
      ...(filters.type && { type: filters.type }),
      ...(filters.status && { status: filters.status }),
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...((startDate || endDate) && {
        effectiveDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
      isDeleted: false,
    };

    const incentives = await prisma.employeeIncentive.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            departmentAssignments: {
              include: { department: true },
            },
          },
        },
      },
      orderBy: { effectiveDate: "asc" },
    });

    let totalCreditAmount = 0;
    let totalDebitAmount = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let processedCount = 0;
    let rejectedCount = 0;

    const monthlyMap = new Map<string, {
      monthKey: string;
      monthName: string;
      year: number;
      credits: number;
      debits: number;
      net: number;
    }>();

    const employeeMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      employeeCode: string;
      avatarUrl: any;
      designation: string;
      department: string;
      totalCredits: number;
      totalDebits: number;
      netIncentives: number;
      incentiveCount: number;
    }>();

    for (const inc of incentives) {
      const amt = Number(inc.amount);
      const isCredit = inc.type === "CREDIT";

      if (isCredit) totalCreditAmount += amt;
      else totalDebitAmount += amt;

      if (inc.status === "APPROVED") approvedCount += 1;
      else if (inc.status === "PENDING") pendingCount += 1;
      else if (inc.status === "PROCESSED_IN_PAYROLL") processedCount += 1;
      else if (inc.status === "REJECTED") rejectedCount += 1;

      // Monthly aggregation
      const date = new Date(inc.effectiveDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthName = date.toLocaleString("en-US", { month: "short", year: "numeric" });

      const existingMonth = monthlyMap.get(monthKey) || {
        monthKey,
        monthName,
        year: date.getFullYear(),
        credits: 0,
        debits: 0,
        net: 0,
      };

      if (isCredit) {
        existingMonth.credits += amt;
        existingMonth.net += amt;
      } else {
        existingMonth.debits += amt;
        existingMonth.net -= amt;
      }
      monthlyMap.set(monthKey, existingMonth);

      // Employee aggregation
      const emp = inc.employee;
      if (emp) {
        const dept = emp.departmentAssignments?.[0]?.department?.name || "General";
        const empName = `${emp.firstName} ${emp.lastName || ""}`.trim();

        const existingEmp = employeeMap.get(emp.id) || {
          employeeId: emp.id,
          employeeName: empName,
          employeeCode: emp.employeeCode,
          avatarUrl: emp.avatarUrl,
          designation: emp.designation,
          department: dept,
          totalCredits: 0,
          totalDebits: 0,
          netIncentives: 0,
          incentiveCount: 0,
        };

        if (isCredit) {
          existingEmp.totalCredits += amt;
          existingEmp.netIncentives += amt;
        } else {
          existingEmp.totalDebits += amt;
          existingEmp.netIncentives -= amt;
        }
        existingEmp.incentiveCount += 1;
        employeeMap.set(emp.id, existingEmp);
      }
    }

    const netIncentives = totalCreditAmount - totalDebitAmount;
    const totalVolume = totalCreditAmount + totalDebitAmount;

    const typeDistribution = [
      {
        type: "CREDIT" as const,
        label: "Credit Incentives / Bonus",
        amount: Math.round(totalCreditAmount),
        percentage: totalVolume > 0 ? Math.round((totalCreditAmount / totalVolume) * 1000) / 10 : 100,
        color: "#10b981", // Emerald
      },
      {
        type: "DEBIT" as const,
        label: "Debit / Penalty Deductions",
        amount: Math.round(totalDebitAmount),
        percentage: totalVolume > 0 ? Math.round((totalDebitAmount / totalVolume) * 1000) / 10 : 0,
        color: "#f43f5e", // Rose
      },
    ];

    const statusDistribution = [
      { status: "APPROVED", label: "Approved", count: approvedCount },
      { status: "PROCESSED_IN_PAYROLL", label: "Processed in Payroll", count: processedCount },
      { status: "PENDING", label: "Pending Approval", count: pendingCount },
      { status: "REJECTED", label: "Rejected", count: rejectedCount },
    ];

    const monthlyTrends = Array.from(monthlyMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((m) => ({
        ...m,
        credits: Math.round(m.credits),
        debits: Math.round(m.debits),
        net: Math.round(m.net),
      }));

    const topEarners = Array.from(employeeMap.values())
      .sort((a, b) => b.netIncentives - a.netIncentives)
      .slice(0, filters.limit || 10)
      .map((e) => ({
        ...e,
        totalCredits: Math.round(e.totalCredits),
        totalDebits: Math.round(e.totalDebits),
        netIncentives: Math.round(e.netIncentives),
      }));

    return {
      totalCreditAmount: Math.round(totalCreditAmount),
      totalDebitAmount: Math.round(totalDebitAmount),
      netIncentives: Math.round(netIncentives),
      totalCount: incentives.length,
      typeDistribution,
      statusDistribution,
      monthlyTrends,
      topEarners,
    };
  }

  /**
   * Fetch attendance & workforce analytics
   */
  async getAttendanceMetrics(organizationId: string, filters: GetHrmsReportQueryInput) {
    const { startDate, endDate } = this.resolveDateRange(filters);

    const where: Prisma.AttendanceWhereInput = {
      organizationId,
      ...(filters.employeeId && { employeeId: filters.employeeId }),
      ...((startDate || endDate) && {
        attendanceDate: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      }),
      ...(filters.departmentId && {
        employee: {
          departmentAssignments: {
            some: { departmentId: filters.departmentId },
          },
        },
      }),
    };

    const attendances = await prisma.attendance.findMany({
      where,
      select: {
        status: true,
        attendanceDate: true,
        employeeId: true,
      },
    });

    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let holidayCount = 0;
    let weekOffCount = 0;

    for (const a of attendances) {
      if (a.status === "PRESENT") presentCount += 1;
      else if (a.status === "HALF_DAY") halfDayCount += 1;
      else if (a.status === "ABSENT") absentCount += 1;
      else if (a.status === "ON_LEAVE") leaveCount += 1;
      else if (a.status === "HOLIDAY") holidayCount += 1;
      else if (a.status === "WEEK_OFF") weekOffCount += 1;
    }

    const totalLogs = attendances.length;
    const effectiveAttended = presentCount + halfDayCount * 0.5 + holidayCount + weekOffCount;
    const overallPercentage = totalLogs > 0 ? Math.round((effectiveAttended / totalLogs) * 1000) / 10 : 100;

    const distribution = [
      { status: "PRESENT", label: "Present (100%)", count: presentCount, color: "#10b981" },
      { status: "HALF_DAY", label: "Half Day (50%)", count: halfDayCount, color: "#f59e0b" },
      { status: "ABSENT", label: "Absent / LOP (0%)", count: absentCount, color: "#f43f5e" },
      { status: "ON_LEAVE", label: "Leaves", count: leaveCount, color: "#3b82f6" },
      { status: "WEEK_OFF", label: "Weekly Offs / Holidays", count: weekOffCount + holidayCount, color: "#8b5cf6" },
    ];

    // Department Headcount
    const departments = await prisma.department.findMany({
      where: { organizationId, isDeleted: false },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            employeeAssignments: true,
          },
        },
      },
    });

    const activeEmployeesCount = await prisma.employee.count({
      where: {
        organizationId,
        isDeleted: false,
        employmentStatus: "ACTIVE",
      },
    });

    const departmentHeadcounts = departments.map((d) => ({
      departmentId: d.id,
      departmentName: d.name,
      employeeCount: d._count.employeeAssignments,
    }));

    return {
      totalLogs,
      presentCount,
      halfDayCount,
      absentCount,
      leaveCount,
      holidayCount,
      weekOffCount,
      overallPercentage,
      activeEmployeesCount,
      distribution,
      departmentHeadcounts,
    };
  }
}

export const hrmsReportsRepo = new HrmsReportsRepository();
