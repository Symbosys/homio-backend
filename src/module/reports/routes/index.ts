import { Router } from "express";
import leadReportRoutes from "./lead-report.routes.js";
import hrmsReportRoutes from "./hrms-report.routes.js";

const reportsRouter = Router();

/**
 * Lead Reports Sub-Router
 * Mounted at: /api/v1/reports/leads
 */
reportsRouter.use("/leads", leadReportRoutes);

/**
 * HRMS Reports Sub-Router (Payroll, Employee Incentives & Attendance)
 * Mounted at: /api/v1/reports/hrms
 */
reportsRouter.use("/hrms", hrmsReportRoutes);

export default reportsRouter;
