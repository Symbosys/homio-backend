import { hrmsReportsRepo } from "../repos/hrms-report.repo.js";
import type {
  GetHrmsReportQueryInput,
  GetHrmsIncentivesReportQueryInput,
} from "../validators/hrms-report.validator.js";

export class HrmsReportsService {
  /**
   * Get combined HRMS Overview Analytics Report (Payroll + Incentives + Attendance)
   */
  async getHrmsReportSummary(organizationId: string, filters: GetHrmsReportQueryInput) {
    const [payroll, incentives, attendance] = await Promise.all([
      hrmsReportsRepo.getPayrollMetrics(organizationId, filters),
      hrmsReportsRepo.getIncentivesMetrics(organizationId, {
        startDate: filters.startDate,
        endDate: filters.endDate,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        year: filters.year,
        preset: filters.preset,
        departmentId: filters.departmentId,
        employeeId: filters.employeeId,
      }),
      hrmsReportsRepo.getAttendanceMetrics(organizationId, filters),
    ]);

    const { startDate, endDate } = hrmsReportsRepo.resolveDateRange(filters);

    return {
      period: {
        startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
        endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
        preset: filters.preset || "custom",
      },
      kpis: {
        totalNetDisbursed: payroll.totalNetDisbursed,
        totalGrossPayroll: payroll.totalGrossPay,
        totalStatutoryDeductions: payroll.totalStatutoryDeductions,
        totalIncentivesPaid: incentives.totalCreditAmount,
        totalIncentiveDebits: incentives.totalDebitAmount,
        netIncentives: incentives.netIncentives,
        activeWorkforce: attendance.activeEmployeesCount,
        overallAttendanceRate: attendance.overallPercentage,
        averageEmployeeNetSalary: payroll.averageNetSalary,
      },
      payroll: {
        totalGrossPay: payroll.totalGrossPay,
        totalNetDisbursed: payroll.totalNetDisbursed,
        totalStatutoryDeductions: payroll.totalStatutoryDeductions,
        totalRecords: payroll.totalRecords,
        monthlyTrends: payroll.monthlyTrends,
        departmentDistribution: payroll.departmentPayrollDistribution,
        statusDistribution: payroll.statusDistribution,
      },
      incentives: {
        totalCredits: incentives.totalCreditAmount,
        totalDebits: incentives.totalDebitAmount,
        netIncentives: incentives.netIncentives,
        totalCount: incentives.totalCount,
        typeDistribution: incentives.typeDistribution,
        statusDistribution: incentives.statusDistribution,
        monthlyTrends: incentives.monthlyTrends,
        topEarners: incentives.topEarners,
      },
      attendance: {
        totalLogs: attendance.totalLogs,
        presentCount: attendance.presentCount,
        halfDayCount: attendance.halfDayCount,
        absentCount: attendance.absentCount,
        leaveCount: attendance.leaveCount,
        holidayWeekOffCount: attendance.holidayCount + attendance.weekOffCount,
        overallPercentage: attendance.overallPercentage,
        distribution: attendance.distribution,
        departmentHeadcounts: attendance.departmentHeadcounts,
      },
    };
  }

  /**
   * Get dedicated Employee Incentives Detailed Analytics Report
   */
  async getEmployeeIncentivesReport(
    organizationId: string,
    filters: GetHrmsIncentivesReportQueryInput
  ) {
    const incentives = await hrmsReportsRepo.getIncentivesMetrics(organizationId, filters);
    const { startDate, endDate } = hrmsReportsRepo.resolveDateRange(filters);

    return {
      period: {
        startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
        endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
        preset: filters.preset || "custom",
      },
      summary: {
        totalCredits: incentives.totalCreditAmount,
        totalDebits: incentives.totalDebitAmount,
        netIncentives: incentives.netIncentives,
        totalCount: incentives.totalCount,
      },
      typeDistribution: incentives.typeDistribution,
      statusDistribution: incentives.statusDistribution,
      monthlyTrends: incentives.monthlyTrends,
      topEarners: incentives.topEarners,
    };
  }
}

export const hrmsReportsService = new HrmsReportsService();
