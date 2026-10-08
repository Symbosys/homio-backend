import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  getEmployeeLeadPerformance,
  getTopLeadPerformers,
} from "../controllers/lead-report.controller.js";

const leadReportRoutes = Router();

// Protect all lead reporting routes
leadReportRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/reports/leads/employee-performance
 * @desc    Fetch lead conversion performance by employee with timeline and distribution metrics
 */
leadReportRoutes.get("/employee-performance", getEmployeeLeadPerformance);

/**
 * @route   GET /api/v1/reports/leads/top-performers
 * @desc    Fetch top performing sales/design personnel ranked by conversions, rate, or revenue
 */
leadReportRoutes.get("/top-performers", getTopLeadPerformers);

export default leadReportRoutes;
