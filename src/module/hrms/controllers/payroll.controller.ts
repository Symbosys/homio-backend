import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { payrollService } from "../services/payroll.service.js";
import {
  createPayrollPeriodSchema,
  updatePayrollPeriodSchema,
  disbursePayrollPeriodSchema,
  getPayrollPeriodsQuerySchema,
  payrollPeriodIdParamSchema,
  getPayrollRecordsQuerySchema,
  getMyPayslipsQuerySchema,
  updatePayrollRecordSchema,
  payrollRecordIdParamSchema,
} from "../validators/payroll.validator.js";

/**
 * Controller: Create monthly payroll batch period
 */
export const createPayrollPeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = createPayrollPeriodSchema.parse({ body: req.body });
  const result = await payrollService.createPayrollPeriod(organizationId, userId, parsed.body);

  return SuccessResponse(res, "Payroll period created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all payroll periods
 */
export const getPayrollPeriods = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getPayrollPeriodsQuerySchema.parse({ query: req.query });
  const result = await payrollService.getPayrollPeriods(organizationId, parsed.query);

  return SuccessResponse(res, "Payroll periods retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single payroll period by ID
 */
export const getPayrollPeriodById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = payrollPeriodIdParamSchema.parse({ params: req.params });
  const result = await payrollService.getPayrollPeriodById(params.id, organizationId);

  return SuccessResponse(res, "Payroll period details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Process payroll period (Automated payroll calculation engine)
 */
export const processPayrollPeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = payrollPeriodIdParamSchema.parse({ params: req.params });
  const result = await payrollService.processPayrollPeriod(params.id, organizationId);

  return SuccessResponse(res, "Payroll processed and calculated successfully for all employees", result, statusCode.OK);
});

/**
 * Controller: Disburse payroll period (Batch payment execution)
 */
export const disbursePayrollPeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = disbursePayrollPeriodSchema.parse({ params: req.params, body: req.body });
  const result = await payrollService.disbursePayrollPeriod(
    parsed.params.id,
    organizationId,
    parsed.body
  );

  return SuccessResponse(res, "Payroll period marked as disbursed successfully", result, statusCode.OK);
});

/**
 * Controller: Delete payroll period
 */
export const deletePayrollPeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = payrollPeriodIdParamSchema.parse({ params: req.params });
  const result = await payrollService.deletePayrollPeriod(params.id, organizationId);

  return SuccessResponse(res, result.message, null, statusCode.OK);
});

/**
 * Controller: Get all payroll records (Payslips) for organization
 */
export const getAllPayrollRecords = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getPayrollRecordsQuerySchema.parse({ query: req.query });
  const result = await payrollService.getAllPayrollRecords(organizationId, parsed.query);

  return SuccessResponse(res, "Payroll records retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get personal payslips for logged-in employee
 */
export const getMyPayslips = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = getMyPayslipsQuerySchema.parse({ query: req.query });
  const result = await payrollService.getMyPayslips(organizationId, userId, parsed.query);

  return SuccessResponse(res, "Your payslips retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single payroll record (Payslip) by ID
 */
export const getPayrollRecordById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = payrollRecordIdParamSchema.parse({ params: req.params });
  const result = await payrollService.getPayrollRecordById(params.id, organizationId);

  return SuccessResponse(res, "Payslip details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update individual payroll record
 */
export const updatePayrollRecord = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updatePayrollRecordSchema.parse({ params: req.params, body: req.body });
  const result = await payrollService.updatePayrollRecord(
    parsed.params.id,
    organizationId,
    parsed.body
  );

  return SuccessResponse(res, "Payroll record updated successfully", result, statusCode.OK);
});

/**
 * Controller: Upload payslip PDF
 */
export const uploadPayslipPdf = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = payrollRecordIdParamSchema.parse({ params: req.params });
  const file = req.file;
  if (!file) {
    throw new ErrorResponse("Payslip PDF file is required", statusCode.Bad_Request);
  }

  const result = await payrollService.uploadPayslipPdf(params.id, organizationId, file);
  return SuccessResponse(res, result.message, result.payslipPdf, statusCode.OK);
});
