import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { projectService } from "../services/project.service.js";
import {
  createProjectSchema,
  updateProjectSchema,
  projectIdParamSchema,
  getProjectsQuerySchema,
} from "../validators/project.validator.js";

/**
 * @route   POST /api/v1/projects
 * @desc    Create a new Project with complete nested sub-components (site, schedule, metric, commercial, members)
 * @access  Private (Authenticated Tenant User)
 */
export const createProject = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProjectSchema.parse({ body: req.body });
  const result = await projectService.createProject(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Project created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects
 * @desc    Fetch paginated list of projects with search, status, health, stage, customer, and team member filters
 * @access  Private (Authenticated Tenant User)
 */
export const getProjects = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getProjectsQuerySchema.parse({ query: req.query });
  const result = await projectService.getProjects(organizationId, parsed.query);
  return SuccessResponse(res, "Projects retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:id
 * @desc    Fetch comprehensive details of a single project by ID including all 5 segregated sub-entities
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = projectIdParamSchema.parse({ params: req.params });
  const result = await projectService.getProjectById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Project details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:id
 * @desc    Update project profile and any/all segregated sub-components (site, schedule, metric, commercial, members)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProject = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectSchema.parse({ params: req.params, body: req.body });
  const result = await projectService.updateProject(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Project updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:id
 * @desc    Soft delete a project
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = projectIdParamSchema.parse({ params: req.params });
  const result = await projectService.deleteProject(parsed.params.id, organizationId);
  return SuccessResponse(res, "Project deleted successfully", result, statusCode.OK);
});
