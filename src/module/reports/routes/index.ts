import { Router } from "express";
import leadReportRoutes from "./lead-report.routes.js";

const reportsRouter = Router();

/**
 * Lead Reports Sub-Router
 * Mounted at: /api/v1/reports/leads
 */
reportsRouter.use("/leads", leadReportRoutes);

export default reportsRouter;
