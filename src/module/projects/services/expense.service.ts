import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { expenseRepo } from "../repos/expense.repo.js";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  UpdateExpensePaymentStatusInput,
  GetExpensesQuery,
  GetExpenseSummaryQuery,
} from "../validators/expense.validator.js";

export class ExpenseService {
  /**
   * Create an Expense with complete relational and tenant validation
   */
  async createExpense(organizationId: string, data: CreateExpenseInput) {
    const { projectId, milestoneId, categoryId, vendorId, createdById, expenseScope } = data;

    // 1. If Project scope, verify project belongs to organization
    if (expenseScope === "PROJECT" || projectId) {
      if (!projectId) {
        throw new ErrorResponse("Project ID is required when expense scope is PROJECT", statusCode.Bad_Request);
      }
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }

      // 2. If milestone supplied, verify it belongs to project
      if (milestoneId) {
        const milestone = await prisma.projectMilestone.findFirst({
          where: { id: milestoneId, projectId, isDeleted: false },
        });
        if (!milestone) {
          throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
        }
      }
    }

    // 3. Verify Category belongs to Organization if supplied
    if (categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: categoryId, organizationId, isDeleted: false },
      });
      if (!category) {
        throw new ErrorResponse("Expense category not found in this organization", statusCode.Bad_Request);
      }
    }

    // 4. Verify Vendor belongs to Organization if supplied
    if (vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: vendorId, organizationId, isDeleted: false },
      });
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in this organization", statusCode.Bad_Request);
      }
    }

    // 5. Verify Creator Employee belongs to Organization if supplied
    if (createdById) {
      const employee = await prisma.employee.findFirst({
        where: { id: createdById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Employee not found in this organization", statusCode.Bad_Request);
      }
    }

    const expense = await expenseRepo.create(organizationId, data);

    // Auto-create timeline event if scoped to a project
    if (projectId) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId,
            title: `Expense Incurred: ₹${Number(expense.amount).toLocaleString()} (${expense.title})`,
            description: expense.description || `Commercial expense logged under payment status ${expense.paymentStatus}.`,
            eventType: "COMMERCIAL_INVOICE",
            category: "EXPENSE",
            status: expense.paymentStatus === "PAID" ? "COMPLETED" : "PLANNED",
            performedById: expense.createdById || null,
            isCustom: false,
            isSystemGenerated: true,
          },
        })
        .catch(() => {});
    }

    return expense;
  }

  /**
   * Get paginated expenses with filters
   */
  async getExpenses(organizationId: string, query: GetExpensesQuery) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return expenseRepo.findAll(organizationId, query);
  }

  /**
   * Get single expense by ID
   */
  async getExpenseById(id: string, organizationId: string) {
    const expense = await expenseRepo.findById(id, organizationId);
    if (!expense) {
      throw new ErrorResponse("Expense not found", statusCode.Not_Found);
    }
    return expense;
  }

  /**
   * Update expense
   */
  async updateExpense(id: string, organizationId: string, data: UpdateExpenseInput) {
    const existing = await expenseRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense not found", statusCode.Not_Found);
    }

    const projectId = data.projectId !== undefined ? data.projectId : existing.projectId;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Bad_Request);
      }

      if (data.milestoneId) {
        const milestone = await prisma.projectMilestone.findFirst({
          where: { id: data.milestoneId, projectId, isDeleted: false },
        });
        if (!milestone) {
          throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
        }
      }
    }

    if (data.categoryId) {
      const category = await prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, organizationId, isDeleted: false },
      });
      if (!category) {
        throw new ErrorResponse("Expense category not found in this organization", statusCode.Bad_Request);
      }
    }

    if (data.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: data.vendorId, organizationId, isDeleted: false },
      });
      if (!vendor) {
        throw new ErrorResponse("Vendor not found in this organization", statusCode.Bad_Request);
      }
    }

    if (data.createdById) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.createdById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return expenseRepo.update(id, organizationId, data, existing);
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(id: string, organizationId: string, data: UpdateExpensePaymentStatusInput) {
    const existing = await expenseRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense not found", statusCode.Not_Found);
    }

    return expenseRepo.updatePaymentStatus(id, data);
  }

  /**
   * Update reimbursement status
   */
  async updateReimbursement(id: string, organizationId: string, isReimbursed: boolean) {
    const existing = await expenseRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense not found", statusCode.Not_Found);
    }

    return expenseRepo.updateReimbursement(id, isReimbursed);
  }

  /**
   * Soft delete expense
   */
  async deleteExpense(id: string, organizationId: string) {
    const existing = await expenseRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense not found", statusCode.Not_Found);
    }

    return expenseRepo.delete(id);
  }

  /**
   * Get financial summary & analytics
   */
  async getExpenseSummary(organizationId: string, query: GetExpenseSummaryQuery) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return expenseRepo.aggregateSummary(organizationId, query);
  }
}

export const expenseService = new ExpenseService();
