import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  getHrmsReportSummary,
  getEmployeeIncentivesReport,
} from "../controllers/hrms-report.controller.js";

const hrmsReportRoutes = Router();

// Protect all HRMS reporting routes
hrmsReportRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/reports/hrms/summary
 * @desc    Fetch comprehensive HRMS overview report (Payroll trends, department distributions, attendance, incentives)
 */
hrmsReportRoutes.get("/summary", getHrmsReportSummary);

/**
 * @route   GET /api/v1/reports/hrms/incentives
 * @desc    Fetch employee incentives report with credit/debit breakdown, monthly trends, and top earners
 */
hrmsReportRoutes.get("/incentives", getEmployeeIncentivesReport);

export default hrmsReportRoutes;
