import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  getOverviewMetrics,
  getProjectMetrics,
} from "../controllers/analytics.controller.js";

const analyticsRoutes = Router({ mergeParams: true });

analyticsRoutes.use(authenticate);

/**
 * @route   GET /api/v1/after-sales/analytics/overview
 * @desc    Get tenant-wide after-sales KPIs and metrics
 */
analyticsRoutes.get(
  "/overview",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getOverviewMetrics
);

/**
 * @route   GET /api/v1/after-sales/analytics/project/:projectId
 * @desc    Get project-specific after-sales metrics & health
 */
analyticsRoutes.get(
  "/project/:projectId",
  authorize("PLATFORM_ADMIN", "ADMIN", "USER"),
  getProjectMetrics
);

export default analyticsRoutes;
