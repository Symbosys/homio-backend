import { z } from "zod";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// EXPENSE ENUMS
// ==========================================

export const ExpenseScopeEnum = z.enum(["PROJECT", "ORGANIZATION"]);

export const ExpensePaymentMethodEnum = z.enum([
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "CHEQUE",
  "PETTY_CASH",
  "OTHER",
]);

export const ExpensePaymentStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAID",
  "PARTIALLY_PAID",
  "REJECTED",
  "CANCELLED",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const expenseIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
});

export const projectExpenseParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createExpenseSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional().nullable(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    vendorId: z.string().uuid("Invalid vendor ID format").optional().nullable(),
    categoryId: z.string().uuid("Invalid category ID format").optional().nullable(),

    title: z.string().min(2, "Title must be at least 2 characters").max(255),
    description: z.string().max(5000).optional().nullable(),
    expenseScope: ExpenseScopeEnum.default("PROJECT"),

    amount: z.coerce.number().min(0, "Amount must be positive"),
    taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative").default(0),
    currency: z.string().default("INR"),

    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expense date must be YYYY-MM-DD format"),
    paymentMethod: ExpensePaymentMethodEnum.default("BANK_TRANSFER"),
    paymentStatus: ExpensePaymentStatusEnum.default("PAID"),
    paidAt: z.string().optional().nullable(),

    invoiceNumber: z.string().max(100).optional().nullable(),
    transactionReference: z.string().max(100).optional().nullable(),

    createdById: z.string().uuid("Invalid createdBy employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    isBillableToClient: z.boolean().default(false),
    isReimbursable: z.boolean().default(false),
    isReimbursed: z.boolean().default(false),

    notes: z.string().max(5000).optional().nullable(),
    tags: z.array(z.string()).default([]),
  }),
});

export const updateExpenseSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional().nullable(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    vendorId: z.string().uuid("Invalid vendor ID format").optional().nullable(),
    categoryId: z.string().uuid("Invalid category ID format").optional().nullable(),

    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    description: z.string().max(5000).optional().nullable(),
    expenseScope: ExpenseScopeEnum.optional(),

    amount: z.coerce.number().min(0, "Amount must be positive").optional(),
    taxAmount: z.coerce.number().min(0, "Tax amount cannot be negative").optional(),
    currency: z.string().optional(),

    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expense date must be YYYY-MM-DD format").optional(),
    paymentMethod: ExpensePaymentMethodEnum.optional(),
    paymentStatus: ExpensePaymentStatusEnum.optional(),
    paidAt: z.string().optional().nullable(),

    invoiceNumber: z.string().max(100).optional().nullable(),
    transactionReference: z.string().max(100).optional().nullable(),

    createdById: z.string().uuid("Invalid createdBy employee ID format").optional().nullable(),

    receiptUrl: imageTypeSchema.optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),

    isBillableToClient: z.boolean().optional(),
    isReimbursable: z.boolean().optional(),
    isReimbursed: z.boolean().optional(),

    notes: z.string().max(5000).optional().nullable(),
    tags: z.array(z.string()).optional(),
  }),
});

export const updateExpensePaymentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
  body: z.object({
    paymentStatus: ExpensePaymentStatusEnum,
    paidAt: z.string().optional().nullable(),
    paymentMethod: ExpensePaymentMethodEnum.optional(),
    transactionReference: z.string().max(100).optional().nullable(),
  }),
});

export const updateExpenseReimbursementSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense ID format"),
  }),
  body: z.object({
    isReimbursed: z.boolean(),
  }),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const getExpensesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    expenseScope: ExpenseScopeEnum.optional(),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional(),
    categoryId: z.string().uuid("Invalid category ID format").optional(),
    vendorId: z.string().uuid("Invalid vendor ID format").optional(),
    paymentStatus: ExpensePaymentStatusEnum.optional(),
    paymentMethod: ExpensePaymentMethodEnum.optional(),
    isBillableToClient: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
    isReimbursable: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
    isReimbursed: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    minAmount: z.coerce.number().optional(),
    maxAmount: z.coerce.number().optional(),
  }),
});

export const getExpenseSummaryQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    expenseScope: ExpenseScopeEnum.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  }),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>["body"];
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>["body"];
export type UpdateExpensePaymentStatusInput = z.infer<typeof updateExpensePaymentStatusSchema>["body"];
export type UpdateExpenseReimbursementInput = z.infer<typeof updateExpenseReimbursementSchema>["body"];
export type GetExpensesQuery = z.infer<typeof getExpensesQuerySchema>["query"];
export type GetExpenseSummaryQuery = z.infer<typeof getExpenseSummaryQuerySchema>["query"];
