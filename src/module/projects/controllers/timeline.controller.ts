import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { timelineService } from "../services/timeline.service.js";
import {
  createTimelineSchema,
  updateTimelineSchema,
  getTimelinesQuerySchema,
  timelineIdParamSchema,
  timelineProjectIdParamSchema,
} from "../validators/timeline.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/timelines
 * @desc    Create a new project timeline event
 * @access  Private (Authenticated Tenant User)
 */
export const createTimeline = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createTimelineSchema.parse({
    params: req.params,
    body: req.body,
  });

  const rawProjectId = req.params.projectId || parsed.body.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required", statusCode.Bad_Request);
  }

  const createdById = req.user?.id;
  const result = await timelineService.createTimeline(
    projectId,
    organizationId,
    parsed.body,
    createdById
  );

  return SuccessResponse(res, "Timeline event created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/timelines
 * @desc    Fetch all timeline events for a project with filters
 * @access  Private (Authenticated Tenant User)
 */
export const getTimelines = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const rawProjectId = req.params.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required", statusCode.Bad_Request);
  }

  const parsed = getTimelinesQuerySchema.parse({
    params: req.params,
    query: req.query,
  });

  const result = await timelineService.getTimelines(
    projectId,
    organizationId,
    parsed.query
  );

  return SuccessResponse(res, "Timeline events fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/timelines/:id
 * @desc    Fetch a single timeline event by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getTimelineById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = timelineIdParamSchema.parse({ params: req.params });
  const rawProjectId = req.params.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required", statusCode.Bad_Request);
  }

  const result = await timelineService.getTimelineById(
    parsed.params.id,
    projectId,
    organizationId
  );

  return SuccessResponse(res, "Timeline event fetched successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/timelines/:id
 * @desc    Update an existing timeline event
 * @access  Private (Authenticated Tenant User)
 */
export const updateTimeline = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTimelineSchema.parse({
    params: req.params,
    body: req.body,
  });

  const rawProjectId = req.params.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required", statusCode.Bad_Request);
  }

  const result = await timelineService.updateTimeline(
    parsed.params.id,
    projectId,
    organizationId,
    parsed.body
  );

  return SuccessResponse(res, "Timeline event updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/timelines/:id
 * @desc    Delete a timeline event
 * @access  Private (Authenticated Tenant User)
 */
export const deleteTimeline = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = timelineIdParamSchema.parse({ params: req.params });
  const rawProjectId = req.params.projectId;
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId;
  if (!projectId) {
    throw new ErrorResponse("Project ID is required", statusCode.Bad_Request);
  }

  const result = await timelineService.deleteTimeline(
    parsed.params.id,
    projectId,
    organizationId
  );

  return SuccessResponse(res, "Timeline event deleted successfully", result, statusCode.OK);
});
