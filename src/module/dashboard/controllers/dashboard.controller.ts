import type { Request, Response } from "express";
import { dashboardService, DashboardService } from "../services/dashboard.service.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  getDashboardAlertsQuerySchema,
  getDashboardOverviewQuerySchema,
} from "../validators/dashboard.validator.js";

/**
 * Controller handling dashboard operations intelligence & alerts
 */
export class DashboardController {
  constructor(private readonly service: DashboardService = dashboardService) {}

  /**
   * @route   GET /api/v1/dashboard/alerts
   * @desc    Get tenant-scoped real-time task bottlenecks, overdue deliverables, site risks, and handover schedules
   */
  getAlerts = async (req: Request, res: Response) => {
    const validated = getDashboardAlertsQuerySchema.parse({ query: req.query });
    const organizationId = (req as any).user.organizationId;

    const alerts = await this.service.getOperationsAlerts(organizationId, validated.query);

    return SuccessResponse(
      res,
      "Dashboard operations alerts retrieved successfully",
      alerts,
      statusCode.OK
    );
  };

  /**
   * @route   GET /api/v1/dashboard/overview
   * @desc    Synthesize complete live operational analytics across tasks and projects
   */
  getOverview = async (req: Request, res: Response) => {
    const validated = getDashboardOverviewQuerySchema.parse({ query: req.query });
    const organizationId = (req as any).user.organizationId;

    const overview = await this.service.getOverviewAnalytics(organizationId, validated.query);

    return SuccessResponse(
      res,
      "Dashboard overview analytics retrieved successfully",
      overview,
      statusCode.OK
    );
  };
}

export const dashboardController = new DashboardController();

