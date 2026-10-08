import { leadReportRepo } from "../repos/lead-report.repo.js";
import type {
  GetEmployeePerformanceQueryInput,
  GetTopPerformersQueryInput,
} from "../validators/lead-report.validator.js";

/**
 * Service orchestrating lead reporting, conversion rates, and employee leaderboard analytics
 */
export class LeadReportService {
  /**
   * Get employee lead conversion performance metrics, time-series, and distribution charts
   *
   * @param organizationId - Tenant organization UUID
   * @param query - Date range, employeeId, departmentId, groupBy, status, source
   * @returns Comprehensive employee conversion metrics and chart data
   */
  async getEmployeePerformance(organizationId: string, query: GetEmployeePerformanceQueryInput) {
    return leadReportRepo.getEmployeePerformance(organizationId, query);
  }

  /**
   * Get ranked top-performing sales/design personnel by conversions, rate, or revenue
   *
   * @param organizationId - Tenant organization UUID
   * @param query - Date range, limit, metric, departmentId
   * @returns Leaderboard rankings and organization benchmark metrics
   */
  async getTopPerformers(organizationId: string, query: GetTopPerformersQueryInput) {
    return leadReportRepo.getTopPerformers(organizationId, query);
  }
}

export const leadReportService = new LeadReportService();
