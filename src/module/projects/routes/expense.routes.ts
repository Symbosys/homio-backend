import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  updateExpensePaymentStatus,
  updateExpenseReimbursement,
  deleteExpense,
  getExpenseSummary,
} from "../controllers/expense.controller.js";

const expenseRoutes = Router({ mergeParams: true });

// Protect all expense routes
expenseRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/projects/expenses/summary or GET /api/v1/projects/:projectId/expenses/summary
 * @desc    Fetch financial summary analytics and category breakdown
 */
expenseRoutes.get("/summary", getExpenseSummary);

/**
 * @route   POST /api/v1/projects/:projectId/expenses or POST /api/v1/projects/expenses
 * @desc    Create an expense (Project-level or Organization overhead)
 */
expenseRoutes.post("/", createExpense);

/**
 * @route   GET /api/v1/projects/:projectId/expenses or GET /api/v1/projects/expenses
 * @desc    Fetch paginated list of expenses with comprehensive filters
 */
expenseRoutes.get("/", getExpenses);

/**
 * @route   GET /api/v1/projects/expenses/:id or GET /api/v1/projects/:projectId/expenses/:id
 * @desc    Fetch detailed breakdown of a single expense
 */
expenseRoutes.get("/:id", getExpenseById);

/**
 * @route   PATCH /api/v1/projects/expenses/:id or PATCH /api/v1/projects/:projectId/expenses/:id
 * @desc    Update expense parameters (amounts, taxes, dates, notes)
 */
expenseRoutes.patch("/:id", updateExpense);

/**
 * @route   PATCH /api/v1/projects/expenses/:id/payment-status
 * @desc    Update payment status and settlement transaction reference (e.g. UTR / Cheque)
 */
expenseRoutes.patch("/:id/payment-status", updateExpensePaymentStatus);

/**
 * @route   PATCH /api/v1/projects/expenses/:id/reimbursement
 * @desc    Mark out-of-pocket employee expense as reimbursed
 */
expenseRoutes.patch("/:id/reimbursement", updateExpenseReimbursement);

/**
 * @route   DELETE /api/v1/projects/expenses/:id or DELETE /api/v1/projects/:projectId/expenses/:id
 * @desc    Soft delete an expense
 */
expenseRoutes.delete("/:id", deleteExpense);

export default expenseRoutes;
