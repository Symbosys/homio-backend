import { z } from "zod";

export const createIncentiveSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Invalid employee ID"),
    type: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    currency: z.string().default("INR"),
    reason: z.string().min(2, "Reason must be at least 2 characters").max(200),
    description: z.string().max(1000).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
    effectiveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Effective date must be in YYYY-MM-DD format")
      .optional(),
  }),
});

export const updateIncentiveSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid incentive ID"),
  }),
  body: z.object({
    type: z.enum(["CREDIT", "DEBIT"]).optional(),
    amount: z.coerce.number().min(0.01).optional(),
    reason: z.string().min(2).max(200).optional(),
    description: z.string().max(1000).optional().nullable(),
    remarks: z.string().max(500).optional().nullable(),
    effectiveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
});

export const getIncentivesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(["CREDIT", "DEBIT"]).optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "PROCESSED_IN_PAYROLL", "CANCELLED"]).optional(),
    employeeId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "effectiveDate", "amount"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const getMyIncentivesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.enum(["CREDIT", "DEBIT"]).optional(),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "PROCESSED_IN_PAYROLL", "CANCELLED"]).optional(),
    year: z.coerce.number().int().optional(),
  }),
});

export const incentiveIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid incentive ID"),
  }),
});

export const rejectIncentiveSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid incentive ID"),
  }),
  body: z.object({
    remarks: z.string().max(500).optional().nullable(),
  }),
});

export type CreateIncentiveInput = z.infer<typeof createIncentiveSchema>["body"];
export type UpdateIncentiveInput = z.infer<typeof updateIncentiveSchema>["body"];
export type GetIncentivesQueryInput = z.infer<typeof getIncentivesQuerySchema>["query"];
export type GetMyIncentivesQueryInput = z.infer<typeof getMyIncentivesQuerySchema>["query"];
export type RejectIncentiveInput = z.infer<typeof rejectIncentiveSchema>["body"];
