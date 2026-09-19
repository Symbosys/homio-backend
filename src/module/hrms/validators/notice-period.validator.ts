import { z } from "zod";

export const applyNoticePeriodSchema = z.object({
  body: z.object({
    noticeStartDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Notice start date must be in YYYY-MM-DD format"),
    noticeDays: z.coerce.number().int().min(0).max(180).default(30),
    expectedLastWorkingDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected last working day must be in YYYY-MM-DD format"),
    reason: z.string().min(2, "Reason must be at least 2 characters").max(200),
    description: z.string().max(2000).optional().nullable(),
  }),
});

export const getNoticePeriodsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN", "COMPLETED"])
      .optional(),
    handoverStatus: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
    isSettled: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
    employeeId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    sortBy: z
      .enum(["createdAt", "noticeStartDate", "expectedLastWorkingDay", "actualLastWorkingDay"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const noticePeriodIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
});

export const approveNoticePeriodSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
  body: z.object({
    expectedLastWorkingDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    adminRemarks: z.string().max(1000).optional().nullable(),
  }),
});

export const rejectNoticePeriodSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
  body: z.object({
    adminRemarks: z.string().min(2, "Rejection remarks are required").max(1000),
  }),
});

export const updateNoticeBuyoutSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
  body: z.object({
    buyoutOption: z.boolean().default(true),
    buyoutDays: z.coerce.number().int().min(1).max(180),
    buyoutAmount: z.coerce.number().min(0),
    actualLastWorkingDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Actual last working day must be in YYYY-MM-DD format")
      .optional(),
    adminRemarks: z.string().max(1000).optional().nullable(),
  }),
});

export const updateHandoverSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
  body: z.object({
    handoverStatus: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]),
    exitInterviewNotes: z.string().max(2000).optional().nullable(),
  }),
});

export const completeSettlementSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid notice period ID"),
  }),
  body: z.object({
    actualLastWorkingDay: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Actual last working day must be in YYYY-MM-DD format"),
    isSettled: z.boolean().default(true),
    adminRemarks: z.string().max(1000).optional().nullable(),
  }),
});

export type ApplyNoticePeriodInput = z.infer<typeof applyNoticePeriodSchema>["body"];
export type GetNoticePeriodsQueryInput = z.infer<typeof getNoticePeriodsQuerySchema>["query"];
export type ApproveNoticePeriodInput = z.infer<typeof approveNoticePeriodSchema>["body"];
export type RejectNoticePeriodInput = z.infer<typeof rejectNoticePeriodSchema>["body"];
export type UpdateNoticeBuyoutInput = z.infer<typeof updateNoticeBuyoutSchema>["body"];
export type UpdateHandoverInput = z.infer<typeof updateHandoverSchema>["body"];
export type CompleteSettlementInput = z.infer<typeof completeSettlementSchema>["body"];
