import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { siteVisitService } from "../services/site-visit.service.js";
import {
  createSiteVisitSchema,
  updateSiteVisitSchema,
  completeSiteVisitSchema,
  getSiteVisitsQuerySchema,
  siteVisitIdParamSchema,
  siteVisitProjectIdParamSchema,
} from "../validators/site-visit.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/site-visits or POST /api/v1/projects/site-visits
 * @desc    Schedule or log a field survey / site visit
 * @access  Private (Authenticated Tenant User)
 */
export const createSiteVisit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createSiteVisitSchema.parse({ params: req.params, body: req.body });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const projectId = paramProjectId || parsed.params?.projectId || parsed.body.projectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required to schedule a site visit", statusCode.Bad_Request);
  }

  const result = await siteVisitService.createSiteVisit(projectId, organizationId, parsed.body);
  return SuccessResponse(res, "Site visit scheduled successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/site-visits or GET /api/v1/projects/site-visits
 * @desc    Fetch paginated list of site visits with search, dates, and status filters
 * @access  Private (Authenticated Tenant User)
 */
export const getSiteVisits = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getSiteVisitsQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await siteVisitService.getSiteVisits(organizationId, query);
  return SuccessResponse(res, "Site visits retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/site-visits/:id or GET /api/v1/projects/site-visits/:id
 * @desc    Fetch comprehensive details of a single site visit
 * @access  Private (Authenticated Tenant User)
 */
export const getSiteVisitById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = siteVisitIdParamSchema.parse({ params: req.params });
  const result = await siteVisitService.getSiteVisitById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Site visit details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/site-visits/:id or PATCH /api/v1/projects/site-visits/:id
 * @desc    Update site visit schedule, visitor employee, or details
 * @access  Private (Authenticated Tenant User)
 */
export const updateSiteVisit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateSiteVisitSchema.parse({ params: req.params, body: req.body });
  const result = await siteVisitService.updateSiteVisit(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Site visit updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/site-visits/:id/complete
 * @desc    Complete site visit with inspection summary, defect snags, and outcome
 * @access  Private (Authenticated Tenant User)
 */
export const completeSiteVisit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = completeSiteVisitSchema.parse({ params: req.params, body: req.body });
  const result = await siteVisitService.completeSiteVisit(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Site visit marked as completed", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/site-visits/:id or DELETE /api/v1/projects/site-visits/:id
 * @desc    Soft delete a site visit entry
 * @access  Private (Authenticated Tenant User)
 */
export const deleteSiteVisit = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = siteVisitIdParamSchema.parse({ params: req.params });
  await siteVisitService.deleteSiteVisit(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Site visit deleted successfully", null, statusCode.OK);
});
