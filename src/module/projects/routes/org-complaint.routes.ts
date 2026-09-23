import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { getOrganizationComplaints } from "../controllers/complaint.controller.js";

const orgComplaintRoutes = Router();

// Protect all organization complaint routes
orgComplaintRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/projects/complaints
 * @desc    Fetch paginated list of complaints across the organization with optional project filter
 */
orgComplaintRoutes.get("/", getOrganizationComplaints);

export default orgComplaintRoutes;
