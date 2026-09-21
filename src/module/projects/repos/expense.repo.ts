import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  UpdateExpensePaymentStatusInput,
  GetExpensesQuery,
  GetExpenseSummaryQuery,
} from "../validators/expense.validator.js";

export class ExpenseRepository {
  /**
   * Create a new Expense (Project or Organization overhead)
   */
  async create(organizationId: string, data: CreateExpenseInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { amount, taxAmount = 0, expenseDate, paidAt, receiptUrl, attachments, ...directFields } = data;
    const totalAmount = amount + (taxAmount || 0);

    return db.expense.create({
      data: {
        ...directFields,
        organizationId,
        amount: new Prisma.Decimal(amount),
        taxAmount: new Prisma.Decimal(taxAmount || 0),
        totalAmount: new Prisma.Decimal(totalAmount),
        expenseDate: new Date(expenseDate),
        paidAt: paidAt ? new Date(paidAt) : null,
        receiptUrl: receiptUrl ? (receiptUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
          },
        },
        vendor: {
          select: {
            id: true,
            code: true,
            name: true,
            companyName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated list of expenses with filters
   */
  async findAll(organizationId: string, query: GetExpensesQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      expenseScope,
      projectId,
      milestoneId,
      categoryId,
      vendorId,
      paymentStatus,
      paymentMethod,
      isBillableToClient,
      isReimbursable,
      isReimbursed,
      startDate,
      endDate,
      minAmount,
      maxAmount,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      isDeleted: false,
      ...(expenseScope && { expenseScope: expenseScope as any }),
      ...(projectId && { projectId }),
      ...(milestoneId && { milestoneId }),
      ...(categoryId && { categoryId }),
      ...(vendorId && { vendorId }),
      ...(paymentStatus && { paymentStatus: paymentStatus as any }),
      ...(paymentMethod && { paymentMethod: paymentMethod as any }),
      ...(isBillableToClient !== undefined && { isBillableToClient }),
      ...(isReimbursable !== undefined && { isReimbursable }),
      ...(isReimbursed !== undefined && { isReimbursed }),
      ...(startDate &&
        endDate && {
          expenseDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(startDate &&
        !endDate && {
          expenseDate: {
            gte: new Date(startDate),
          },
        }),
      ...(!startDate &&
        endDate && {
          expenseDate: {
            lte: new Date(endDate),
          },
        }),
      ...(minAmount !== undefined &&
        maxAmount !== undefined && {
          totalAmount: {
            gte: new Prisma.Decimal(minAmount),
            lte: new Prisma.Decimal(maxAmount),
          },
        }),
      ...(minAmount !== undefined &&
        maxAmount === undefined && {
          totalAmount: {
            gte: new Prisma.Decimal(minAmount),
          },
        }),
      ...(minAmount === undefined &&
        maxAmount !== undefined && {
          totalAmount: {
            lte: new Prisma.Decimal(maxAmount),
          },
        }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { transactionReference: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
          { category: { name: { contains: search, mode: "insensitive" } } },
          { project: { name: { contains: search, mode: "insensitive" } } },
          { project: { projectCode: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      db.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          milestone: {
            select: {
              id: true,
              milestoneCode: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              icon: true,
            },
          },
          vendor: {
            select: {
              id: true,
              code: true,
              name: true,
              companyName: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      db.expense.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single expense by ID with tenant verification
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expense.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            color: true,
            icon: true,
            isTaxDeductible: true,
          },
        },
        vendor: {
          select: {
            id: true,
            code: true,
            name: true,
            companyName: true,
            email: true,
            phone: true,
            gstin: true,
            panNumber: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Update expense parameters
   */
  async update(id: string, organizationId: string, data: UpdateExpenseInput, existingExpense: any, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { amount, taxAmount, expenseDate, paidAt, receiptUrl, attachments, ...directFields } = data;

    const newAmount = amount !== undefined ? amount : Number(existingExpense.amount);
    const newTaxAmount = taxAmount !== undefined ? taxAmount : Number(existingExpense.taxAmount);
    const newTotalAmount = newAmount + newTaxAmount;

    const updatePayload: Prisma.ExpenseUpdateInput = {
      ...directFields,
      ...(amount !== undefined && { amount: new Prisma.Decimal(newAmount) }),
      ...(taxAmount !== undefined && { taxAmount: new Prisma.Decimal(newTaxAmount) }),
      ...((amount !== undefined || taxAmount !== undefined) && { totalAmount: new Prisma.Decimal(newTotalAmount) }),
      ...(expenseDate && { expenseDate: new Date(expenseDate) }),
      ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
      ...(receiptUrl !== undefined && {
        receiptUrl: receiptUrl ? (receiptUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
      ...(attachments !== undefined && {
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
    };

    return db.expense.update({
      where: { id },
      data: updatePayload,
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            icon: true,
          },
        },
        vendor: {
          select: {
            id: true,
            code: true,
            name: true,
            companyName: true,
          },
        },
      },
    });
  }

  /**
   * Update payment status and transaction details
   */
  async updatePaymentStatus(id: string, data: UpdateExpensePaymentStatusInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { paymentStatus, paidAt, paymentMethod, transactionReference } = data;

    return db.expense.update({
      where: { id },
      data: {
        paymentStatus: paymentStatus as any,
        paidAt: paidAt ? new Date(paidAt) : paymentStatus === "PAID" ? new Date() : null,
        ...(paymentMethod && { paymentMethod: paymentMethod as any }),
        ...(transactionReference !== undefined && { transactionReference }),
      },
      include: {
        category: true,
        vendor: true,
      },
    });
  }

  /**
   * Update reimbursement status
   */
  async updateReimbursement(id: string, isReimbursed: boolean, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expense.update({
      where: { id },
      data: { isReimbursed },
    });
  }

  /**
   * Soft delete expense
   */
  async delete(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.expense.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Calculate financial summary and category breakdown
   */
  async aggregateSummary(organizationId: string, query: GetExpenseSummaryQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { projectId, expenseScope, startDate, endDate } = query;

    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(expenseScope && { expenseScope: expenseScope as any }),
      ...(startDate &&
        endDate && {
          expenseDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const [expenses, categoryGroups] = await Promise.all([
      db.expense.findMany({
        where,
        select: {
          amount: true,
          taxAmount: true,
          totalAmount: true,
          paymentStatus: true,
          isBillableToClient: true,
          isReimbursable: true,
          isReimbursed: true,
        },
      }),
      db.expense.groupBy({
        by: ["categoryId"],
        where,
        _sum: {
          amount: true,
          taxAmount: true,
          totalAmount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    let totalGrossAmount = 0;
    let totalTaxAmount = 0;
    let totalNetAmount = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;
    let totalBillableAmount = 0;
    let totalReimbursablePending = 0;

    for (const exp of expenses) {
      const amt = Number(exp.amount);
      const tax = Number(exp.taxAmount);
      const tot = Number(exp.totalAmount);

      totalGrossAmount += amt;
      totalTaxAmount += tax;
      totalNetAmount += tot;

      if (exp.paymentStatus === "PAID") {
        totalPaidAmount += tot;
      } else {
        totalPendingAmount += tot;
      }

      if (exp.isBillableToClient) {
        totalBillableAmount += tot;
      }

      if (exp.isReimbursable && !exp.isReimbursed) {
        totalReimbursablePending += tot;
      }
    }

    const categoryIds = categoryGroups.map((g) => g.categoryId).filter(Boolean) as string[];
    const categories = categoryIds.length
      ? await db.expenseCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, color: true, icon: true },
        })
      : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const categoryBreakdown = categoryGroups.map((group) => {
      const cat = group.categoryId ? categoryMap.get(group.categoryId) : null;
      return {
        categoryId: group.categoryId,
        categoryName: cat?.name || "Uncategorized",
        color: cat?.color || null,
        icon: cat?.icon || null,
        count: group._count.id,
        amount: Number(group._sum.amount || 0),
        taxAmount: Number(group._sum.taxAmount || 0),
        totalAmount: Number(group._sum.totalAmount || 0),
      };
    });

    return {
      totalCount: expenses.length,
      totalGrossAmount,
      totalTaxAmount,
      totalNetAmount,
      totalPaidAmount,
      totalPendingAmount,
      totalBillableAmount,
      totalReimbursablePending,
      categoryBreakdown,
    };
  }
}

export const expenseRepo = new ExpenseRepository();
