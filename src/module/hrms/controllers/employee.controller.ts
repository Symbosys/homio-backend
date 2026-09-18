import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { employeeService } from "../services/employee.service.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeIdParamSchema,
  getEmployeesQuerySchema,
} from "../validators/employee.validator.js";

/**
 * Controller: Create a new employee
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createEmployeeSchema.parse({ body: req.body });
  const result = await employeeService.createEmployee(
    organizationId,
    parsed.body,
    req.file,
    req.user?.id
  );

  return SuccessResponse(res, "Employee created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all employees with pagination and filters
 */
export const getAllEmployees = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getEmployeesQuerySchema.parse({ query: req.query });
  const result = await employeeService.getAllEmployees(organizationId, parsed.query);

  return SuccessResponse(res, "Employees retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single employee by ID
 */
export const getEmployeeById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = employeeIdParamSchema.parse({ params: req.params });
  const result = await employeeService.getEmployeeById(parsed.params.id, organizationId);

  return SuccessResponse(res, "Employee retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update employee
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateEmployeeSchema.parse({ params: req.params, body: req.body });
  const result = await employeeService.updateEmployee(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.file,
    req.user?.id
  );

  return SuccessResponse(res, "Employee updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete employee
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = employeeIdParamSchema.parse({ params: req.params });
  await employeeService.deleteEmployee(parsed.params.id, organizationId);

  return SuccessResponse(res, "Employee deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Get organizational hierarchy
 */
export const getEmployeeHierarchy = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const rootId = req.query.rootEmployeeId as string | undefined;
  const result = await employeeService.getHierarchyTree(organizationId, rootId);

  return SuccessResponse(res, "Employee hierarchy retrieved successfully", result, statusCode.OK);
});
