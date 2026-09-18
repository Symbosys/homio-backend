import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { teamService } from "../services/team.service.js";
import {
  createTeamSchema,
  updateTeamSchema,
  teamIdParamSchema,
  departmentTeamsParamSchema,
  getTeamsQuerySchema,
} from "../validators/team.validator.js";

/**
 * Controller: Create team under a department
 */
export const createTeam = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createTeamSchema.parse({ params: req.params, body: req.body });
  const departmentId = parsed.params?.departmentId || parsed.body.departmentId;

  if (!departmentId) {
    throw new ErrorResponse("Department ID is required to create a team", statusCode.Bad_Request);
  }

  const result = await teamService.createTeam(
    organizationId,
    departmentId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Team created successfully", result, statusCode.Created);
});

/**
 * Controller: List all teams across organization
 */
export const getTeams = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getTeamsQuerySchema.parse({ query: req.query });
  const result = await teamService.getTeams(organizationId, parsed.query);

  return SuccessResponse(res, "Teams retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: List teams for a specific department
 */
export const getDepartmentTeams = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = departmentTeamsParamSchema.parse({ params: req.params });
  const result = await teamService.getDepartmentTeams(params.departmentId, organizationId);

  return SuccessResponse(res, "Department teams retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get team by ID
 */
export const getTeamById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = teamIdParamSchema.parse({ params: req.params });
  const result = await teamService.getTeamById(params.id, organizationId);

  return SuccessResponse(res, "Team retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update team
 */
export const updateTeam = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateTeamSchema.parse({ params: req.params, body: req.body });
  const result = await teamService.updateTeam(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Team updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete team
 */
export const deleteTeam = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = teamIdParamSchema.parse({ params: req.params });
  await teamService.deleteTeam(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Team deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Get members of a team
 */
export const getTeamMembers = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = teamIdParamSchema.parse({ params: req.params });
  const result = await teamService.getTeamMembers(params.id, organizationId);

  return SuccessResponse(res, "Team members retrieved successfully", result, statusCode.OK);
});
