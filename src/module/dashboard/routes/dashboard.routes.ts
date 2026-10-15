import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { dashboardController } from "../controllers/dashboard.controller.js";

const dashboardRoutes = Router();

// Protect all dashboard operations endpoints
dashboardRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/dashboard/alerts
 * @desc    Fetch tenant-scoped operational alerts across tasks, reviews, site risks, and handovers
 */
dashboardRoutes.get("/alerts", dashboardController.getAlerts);

/**
 * @route   GET /api/v1/dashboard/overview
 * @desc    Fetch tenant-scoped live aggregated analytics across tasks, project stages, velocity, and health
 */
dashboardRoutes.get("/overview", dashboardController.getOverview);

export default dashboardRoutes;

