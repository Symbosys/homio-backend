import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { projectServiceService } from "../services/project-service.service.js";
import {
  createProjectServiceSchema,
  updateProjectServiceSchema,
  updateProjectServiceStatusSchema,
  getProjectServicesQuerySchema,
  projectServiceIdParamSchema,
} from "../validators/project-service.validator.js";

/**
 * @route   POST /api/v1/labour/services
 * @desc    Create a new Project Service scope of work
 * @access  Private (Authenticated Tenant User)
 */
export const createProjectService = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProjectServiceSchema.parse({ body: req.body });
  const result = await projectServiceService.createService(parsed.body, organizationId);
  return SuccessResponse(res, "Project service created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/services
 * @desc    Fetch paginated Project Services with multi-criteria filters
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectServices = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getProjectServicesQuerySchema.parse({ query: req.query });
  const result = await projectServiceService.getServices(parsed.query, organizationId);
  return SuccessResponse(res, "Project services retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/services/:id
 * @desc    Get Project Service details with allocated workforce and financial rollups
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectServiceById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = projectServiceIdParamSchema.parse({ params: req.params });
  const result = await projectServiceService.getServiceById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Project service retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/services/:id
 * @desc    Full symmetric update of Project Service specifications (Rule 19)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectService = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParam = projectServiceIdParamSchema.parse({ params: req.params });
  const parsedBody = updateProjectServiceSchema.shape.body.parse(req.body);
  const result = await projectServiceService.updateService(
    parsedParam.params.id,
    parsedBody,
    organizationId
  );
  return SuccessResponse(res, "Project service updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/services/:id/status
 * @desc    Update lifecycle status of Project Service
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectServiceStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectServiceStatusSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await projectServiceService.updateServiceStatus(
    parsed.params.id,
    parsed.body.status,
    organizationId
  );
  return SuccessResponse(res, "Project service status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/services/:id
 * @desc    Soft delete a Project Service
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProjectService = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = projectServiceIdParamSchema.parse({ params: req.params });
  await projectServiceService.deleteService(parsed.params.id, organizationId);
  return SuccessResponse(res, "Project service deleted successfully", null, statusCode.OK);
});
