import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  analyticsRepository,
  type AnalyticsRepository,
} from "../repos/analytics.repo.js";

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository = analyticsRepository) {}

  /**
   * Get tenant-wide after-sales KPIs
   */
  async getOverviewMetrics(organizationId: string) {
    return this.repo.getOverviewMetrics(organizationId);
  }

  /**
   * Get project-specific after-sales metrics
   */
  async getProjectMetrics(organizationId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    return this.repo.getProjectMetrics(organizationId, projectId);
  }
}

export const analyticsService = new AnalyticsService();
