import { z } from "zod";

const dateStringSchema = z
  .string({ message: "Date is required" })
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"));

export const createPayrollPeriodSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100), // e.g. "September 2026"
    month: z.number().int().min(1).max(12, "Month must be between 1 and 12"),
    year: z.number().int().min(2020).max(2100),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    currency: z.string().default("INR"),
  }),
});

export const updatePayrollPeriodSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payroll period ID"),
  }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    status: z.enum(["DRAFT", "PROCESSED", "DISBURSED", "CANCELLED"]).optional(),
    bankBatchRef: z.string().max(100).optional().nullable(),
  }),
});

export const disbursePayrollPeriodSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payroll period ID"),
  }),
  body: z.object({
    bankBatchRef: z.string().min(1, "Bank/CMS batch reference is required"),
    paymentMode: z.enum(["BANK_TRANSFER", "CHEQUE", "CASH", "UPI"]).default("BANK_TRANSFER"),
  }),
});

export const getPayrollPeriodsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["DRAFT", "PROCESSED", "DISBURSED", "CANCELLED"]).optional(),
    year: z.coerce.number().int().optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "startDate", "month", "year"]).default("startDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const payrollPeriodIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payroll period ID"),
  }),
});

export const getPayrollRecordsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    payrollPeriodId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]).optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "netPay", "grossEarnings"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const getMyPayslipsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    year: z.coerce.number().int().optional(),
  }),
});

export const updatePayrollRecordSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payroll record ID"),
  }),
  body: z.object({
    workingDays: z.number().int().min(0).max(31).optional(),
    presentDays: z.number().min(0).max(31).optional(),
    paidLeaveDays: z.number().min(0).max(31).optional(),
    unpaidLeaveDays: z.number().min(0).max(31).optional(),
    penaltyDeductionDays: z.number().min(0).max(31).optional(),
    basicSalary: z.number().min(0).optional(),
    hra: z.number().min(0).optional(),
    conveyanceAllowance: z.number().min(0).optional(),
    specialAllowance: z.number().min(0).optional(),
    medicalAllowance: z.number().min(0).optional(),
    otherAllowances: z.number().min(0).optional(),
    incentivesTotal: z.number().min(0).optional(),
    travelReimbursement: z.number().min(0).optional(),
    pfEmployee: z.number().min(0).optional(),
    esiEmployee: z.number().min(0).optional(),
    professionalTax: z.number().min(0).optional(),
    tds: z.number().min(0).optional(),
    policyPenaltyDeduction: z.number().min(0).optional(),
    otherDeductions: z.number().min(0).optional(),
    paymentMode: z.enum(["BANK_TRANSFER", "CHEQUE", "CASH", "UPI"]).optional(),
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]).optional(),
    paymentReference: z.string().max(100).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
  }),
});

export const payrollRecordIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payroll record ID"),
  }),
});

export type CreatePayrollPeriodInput = z.infer<typeof createPayrollPeriodSchema>["body"];
export type UpdatePayrollPeriodInput = z.infer<typeof updatePayrollPeriodSchema>["body"];
export type DisbursePayrollPeriodInput = z.infer<typeof disbursePayrollPeriodSchema>["body"];
export type GetPayrollPeriodsQueryInput = z.infer<typeof getPayrollPeriodsQuerySchema>["query"];
export type GetPayrollRecordsQueryInput = z.infer<typeof getPayrollRecordsQuerySchema>["query"];
export type GetMyPayslipsQueryInput = z.infer<typeof getMyPayslipsQuerySchema>["query"];
export type UpdatePayrollRecordInput = z.infer<typeof updatePayrollRecordSchema>["body"];
