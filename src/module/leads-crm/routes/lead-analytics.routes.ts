import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { getPipelineAnalytics } from "../controllers/lead-analytics.controller.js";

const leadAnalyticsRoutes = Router();

// Protect all lead analytics routes
leadAnalyticsRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/crm/analytics/pipeline
 * @desc    Fetch CRM pipeline analytics, stage distribution, conversion rates, and revenue projections
 */
leadAnalyticsRoutes.get("/pipeline", getPipelineAnalytics);

export default leadAnalyticsRoutes;
