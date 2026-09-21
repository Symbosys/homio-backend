import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { milestoneService } from "../services/milestone.service.js";
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  getMilestonesQuerySchema,
  milestoneProjectIdParamSchema,
  milestoneIdParamSchema,
  toggleChecklistParamSchema,
} from "../validators/milestone.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/milestones
 * @desc    Create a project milestone with optional nested subtasks & attachments
 * @access  Private (Authenticated Tenant User)
 */
export const createMilestone = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = createMilestoneSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await milestoneService.createMilestone(
    parsed.params.projectId,
    organizationId,
    parsed.body,
  );
  return SuccessResponse(
    res,
    "Milestone created successfully",
    result,
    statusCode.Created,
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/milestones
 * @desc    Fetch all milestones for a project with checklist summary counts and filters
 * @access  Private (Authenticated Tenant User)
 */
export const getMilestones = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = milestoneProjectIdParamSchema.parse({
    params: req.params,
  });
  const parsedQuery = getMilestonesQuerySchema.parse({ query: req.query });

  const result = await milestoneService.getMilestones(
    parsedParams.params.projectId,
    organizationId,
    parsedQuery.query,
  );
  return SuccessResponse(
    res,
    "Milestones retrieved successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/milestones/:id
 * @desc    Fetch comprehensive details of a single milestone by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getMilestoneById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = milestoneIdParamSchema.parse({ params: req.params });
  const result = await milestoneService.getMilestoneById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
  );
  return SuccessResponse(
    res,
    "Milestone details retrieved successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/projects/:projectId/milestones/:id
 * @desc    Update milestone details and sync checklist items
 * @access  Private (Authenticated Tenant User)
 */
export const updateMilestone = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = updateMilestoneSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await milestoneService.updateMilestone(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body,
  );
  return SuccessResponse(
    res,
    "Milestone updated successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/projects/:projectId/milestones/:milestoneId/checklists/:checklistId/toggle
 * @desc    Toggle checklist item completion status and auto-recalculate milestone progress
 * @access  Private (Authenticated Tenant User)
 */
export const toggleChecklistItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = toggleChecklistParamSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await milestoneService.toggleChecklist(
    parsed.params.checklistId,
    parsed.params.milestoneId,
    parsed.params.projectId,
    organizationId,
    parsed.body?.isCompleted,
  );
  return SuccessResponse(
    res,
    "Checklist item updated successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   DELETE /api/v1/projects/:projectId/milestones/:id
 * @desc    Soft delete a project milestone
 * @access  Private (Authenticated Tenant User)
 */
export const deleteMilestone = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = milestoneIdParamSchema.parse({ params: req.params });
  const result = await milestoneService.deleteMilestone(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
  );
  return SuccessResponse(
    res,
    "Milestone deleted successfully",
    result,
    statusCode.OK,
  );
});
