import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createSiteVisit,
  getSiteVisits,
  getSiteVisitById,
  updateSiteVisit,
  completeSiteVisit,
  deleteSiteVisit,
} from "../controllers/site-visit.controller.js";

const siteVisitRoutes = Router({ mergeParams: true });

// Protect all site visit routes
siteVisitRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/projects/:projectId/site-visits or POST /api/v1/projects/site-visits
 * @desc    Schedule or log a field survey / site visit
 */
siteVisitRoutes.post("/", createSiteVisit);

/**
 * @route   GET /api/v1/projects/:projectId/site-visits or GET /api/v1/projects/site-visits
 * @desc    Fetch paginated list of site visits with search, dates, and status filters
 */
siteVisitRoutes.get("/", getSiteVisits);

/**
 * @route   GET /api/v1/projects/:projectId/site-visits/:id or GET /api/v1/projects/site-visits/:id
 * @desc    Fetch comprehensive details of a single site visit
 */
siteVisitRoutes.get("/:id", getSiteVisitById);

/**
 * @route   PATCH /api/v1/projects/:projectId/site-visits/:id or PATCH /api/v1/projects/site-visits/:id
 * @desc    Update site visit schedule, visitor employee, or details
 */
siteVisitRoutes.patch("/:id", updateSiteVisit);

/**
 * @route   PATCH /api/v1/projects/:projectId/site-visits/:id/complete or PATCH /api/v1/projects/site-visits/:id/complete
 * @desc    Complete site visit with inspection summary, defect snags, and outcome
 */
siteVisitRoutes.patch("/:id/complete", completeSiteVisit);

/**
 * @route   DELETE /api/v1/projects/:projectId/site-visits/:id or DELETE /api/v1/projects/site-visits/:id
 * @desc    Soft delete a site visit entry
 */
siteVisitRoutes.delete("/:id", deleteSiteVisit);

export default siteVisitRoutes;
