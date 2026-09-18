import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { departmentService } from "../services/department.service.js";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentIdParamSchema,
  getDepartmentsQuerySchema,
} from "../validators/department.validator.js";

/**
 * Controller: Create a new department
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createDepartmentSchema.parse({ body: req.body });
  const result = await departmentService.createDepartment(organizationId, parsed.body, req.user?.id);

  return SuccessResponse(res, "Department created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all departments
 */
export const getDepartments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getDepartmentsQuerySchema.parse({ query: req.query });
  const result = await departmentService.getDepartments(organizationId, parsed.query);

  return SuccessResponse(res, "Departments retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single department by ID
 */
export const getDepartmentById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = departmentIdParamSchema.parse({ params: req.params });
  const result = await departmentService.getDepartmentById(params.id, organizationId);

  return SuccessResponse(res, "Department retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update department
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateDepartmentSchema.parse({ params: req.params, body: req.body });
  const result = await departmentService.updateDepartment(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Department updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete department
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = departmentIdParamSchema.parse({ params: req.params });
  await departmentService.deleteDepartment(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Department deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Get members of a department
 */
export const getDepartmentMembers = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = departmentIdParamSchema.parse({ params: req.params });
  const result = await departmentService.getDepartmentMembers(params.id, organizationId);

  return SuccessResponse(res, "Department members retrieved successfully", result, statusCode.OK);
});
