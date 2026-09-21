import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { expenseService } from "../services/expense.service.js";
import {
  createExpenseSchema,
  updateExpenseSchema,
  updateExpensePaymentStatusSchema,
  updateExpenseReimbursementSchema,
  getExpensesQuerySchema,
  getExpenseSummaryQuerySchema,
  expenseIdParamSchema,
  projectExpenseParamSchema,
} from "../validators/expense.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/expenses or POST /api/v1/projects/expenses
 * @desc    Create an expense (Project-level or Organization overhead)
 * @access  Private (Authenticated Tenant User)
 */
export const createExpense = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createExpenseSchema.parse({ params: req.params, body: req.body });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const payload = {
    ...parsed.body,
    ...(paramProjectId && { projectId: paramProjectId, expenseScope: "PROJECT" as const }),
  };

  const result = await expenseService.createExpense(organizationId, payload);
  return SuccessResponse(res, "Expense recorded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/expenses or GET /api/v1/projects/expenses
 * @desc    Fetch paginated list of expenses with comprehensive filters
 * @access  Private (Authenticated Tenant User)
 */
export const getExpenses = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getExpensesQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await expenseService.getExpenses(organizationId, query);
  return SuccessResponse(res, "Expenses retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/expenses/summary or GET /api/v1/projects/:projectId/expenses/summary
 * @desc    Fetch financial summary analytics and category breakdown
 * @access  Private (Authenticated Tenant User)
 */
export const getExpenseSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getExpenseSummaryQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await expenseService.getExpenseSummary(organizationId, query);
  return SuccessResponse(res, "Expense summary retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/expenses/:id or GET /api/v1/projects/:projectId/expenses/:id
 * @desc    Fetch detailed breakdown of a single expense
 * @access  Private (Authenticated Tenant User)
 */
export const getExpenseById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = expenseIdParamSchema.parse({ params: req.params });
  const result = await expenseService.getExpenseById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Expense details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/expenses/:id or PATCH /api/v1/projects/:projectId/expenses/:id
 * @desc    Update expense parameters (amounts, taxes, dates, notes)
 * @access  Private (Authenticated Tenant User)
 */
export const updateExpense = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateExpenseSchema.parse({ params: req.params, body: req.body });
  const result = await expenseService.updateExpense(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Expense updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/expenses/:id/payment-status
 * @desc    Update payment status and settlement transaction reference (e.g. UTR / Cheque)
 * @access  Private (Authenticated Tenant User)
 */
export const updateExpensePaymentStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateExpensePaymentStatusSchema.parse({ params: req.params, body: req.body });
  const result = await expenseService.updatePaymentStatus(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Expense payment status updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/expenses/:id/reimbursement
 * @desc    Mark out-of-pocket employee expense as reimbursed
 * @access  Private (Authenticated Tenant User)
 */
export const updateExpenseReimbursement = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateExpenseReimbursementSchema.parse({ params: req.params, body: req.body });
  const result = await expenseService.updateReimbursement(parsed.params.id, organizationId, parsed.body.isReimbursed);
  return SuccessResponse(res, "Expense reimbursement status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/expenses/:id or DELETE /api/v1/projects/:projectId/expenses/:id
 * @desc    Soft delete an expense
 * @access  Private (Authenticated Tenant User)
 */
export const deleteExpense = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = expenseIdParamSchema.parse({ params: req.params });
  await expenseService.deleteExpense(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Expense deleted successfully", null, statusCode.OK);
});
