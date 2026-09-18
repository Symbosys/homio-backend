import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { salaryService } from "../services/salary.service.js";
import {
  createSalaryStructureSchema,
  updateSalaryStructureSchema,
  salaryIdParamSchema,
  employeeSalaryHistoryParamSchema,
} from "../validators/salary.validator.js";

/**
 * Controller: Assign initial salary or create salary revision (with SCD Type 2 period closing)
 */
export const createSalaryRevision = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createSalaryStructureSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await salaryService.createSalaryRevision(
    organizationId,
    parsed.params.employeeId,
    parsed.body,
    req.file,
    req.user?.id
  );

  return SuccessResponse(res, "Salary structure recorded successfully", result, statusCode.Created);
});

/**
 * Controller: Get full salary history for an employee
 */
export const getEmployeeSalaryHistory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = employeeSalaryHistoryParamSchema.parse({ params: req.params });
  const result = await salaryService.getSalaryHistory(parsed.params.employeeId, organizationId);

  return SuccessResponse(res, "Salary history retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get currently active salary structure for an employee
 */
export const getCurrentSalary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = employeeSalaryHistoryParamSchema.parse({ params: req.params });
  const result = await salaryService.getCurrentSalary(parsed.params.employeeId, organizationId);

  return SuccessResponse(res, "Current salary structure retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get specific salary record by ID
 */
export const getSalaryById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = salaryIdParamSchema.parse({ params: req.params });
  const result = await salaryService.getSalaryById(parsed.params.id, organizationId);

  return SuccessResponse(res, "Salary record retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update existing salary structure
 */
export const updateSalary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateSalaryStructureSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await salaryService.updateSalary(
    parsed.params.salaryId,
    organizationId,
    parsed.body,
    req.file
  );

  return SuccessResponse(res, "Salary structure updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete salary structure
 */
export const deleteSalary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = salaryIdParamSchema.parse({ params: req.params });
  await salaryService.deleteSalary(parsed.params.id, organizationId);

  return SuccessResponse(res, "Salary record deleted successfully", null, statusCode.OK);
});
