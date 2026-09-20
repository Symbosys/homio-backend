import { leadRepo } from "../repos/lead.repo.js";
import type { LeadAnalyticsQueryInput } from "../validators/lead-analytics.validator.js";

export class LeadAnalyticsService {
  /**
   * Get CRM pipeline analytics, stage distributions, and performance metrics
   */
  async getPipelineAnalytics(organizationId: string, query: LeadAnalyticsQueryInput) {
    return leadRepo.getAnalytics(organizationId, query);
  }
}

export const leadAnalyticsService = new LeadAnalyticsService();
