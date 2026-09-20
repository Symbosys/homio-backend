import { z } from "zod";

export const leaveStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export const halfDaySessionEnum = z.enum(["FIRST_HALF", "SECOND_HALF"]);

const dateStringSchema = z
  .string({ message: "Date is required" })
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"));

const optionalDateStringSchema = z
  .string()
  .optional()
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional());

export const applyLeaveSchema = z.object({
  body: z.object({
    leaveTypeId: z.string().uuid("Invalid leave type ID"),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    isHalfDay: z.coerce.boolean().default(false).optional(),
    halfDaySession: halfDaySessionEnum.nullable().optional(),
    reason: z.string({ message: "Reason is required" }).trim().min(3, "Reason must be at least 3 characters").max(500),
  }),
});

export const getLeaveRequestsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: leaveStatusEnum.optional(),
    leaveTypeId: z.string().uuid("Invalid leave type ID").optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
    employeeId: z.string().uuid("Invalid employee ID").optional(),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
    search: z.string().trim().optional(),
    sortBy: z.enum(["startDate", "endDate", "createdAt", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const getMyLeavesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: leaveStatusEnum.optional(),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
  }),
});

export const leaveRequestIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid leave request ID format"),
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
  }),
});

export const approveLeaveSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid leave request ID format"),
  }),
  body: z.object({
    adminRemarks: z.string().trim().max(500).optional(),
  }),
});

export const rejectLeaveSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid leave request ID format"),
  }),
  body: z.object({
    adminRemarks: z.string({ message: "Rejection reason is required" }).trim().min(3, "Please provide a reason for rejection").max(500),
  }),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>["body"];
export type GetLeaveRequestsQueryInput = z.infer<typeof getLeaveRequestsQuerySchema>["query"];
export type GetMyLeavesQueryInput = z.infer<typeof getMyLeavesQuerySchema>["query"];
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>["body"];
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>["body"];
