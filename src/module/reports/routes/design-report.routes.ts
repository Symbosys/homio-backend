import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { getDesignAnalytics } from "../controllers/design-report.controller.js";

const designReportRoutes = Router();

// Protect all design reporting routes
designReportRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/reports/designs/analytics
 * @desc    Fetch comprehensive design & DAM analytics with project, employee, and date filters
 */
designReportRoutes.get("/analytics", getDesignAnalytics);

export default designReportRoutes;
