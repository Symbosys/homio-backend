import { z } from "zod";

export const leaveTypeStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const createLeaveTypeSchema = z.object({
  body: z.object({
    name: z.string({ message: "Leave type name is required" }).trim().min(1, "Name cannot be empty").max(100),
    code: z.string({ message: "Leave type code is required" }).trim().min(1, "Code cannot be empty").max(20).toUpperCase(),
    description: z.string().trim().nullable().optional(),
    daysAllowedPerYear: z.coerce.number().min(0, "Days allowed cannot be negative").max(365, "Cannot exceed 365 days").default(12),
    isPaid: z.boolean().default(true).optional(),
    carryForward: z.boolean().default(false).optional(),
    maxCarryForwardDays: z.coerce.number().min(0).max(365).nullable().optional(),
    status: leaveTypeStatusEnum.default("ACTIVE").optional(),
  }),
});

export const updateLeaveTypeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid leave type ID format"),
  }),
  body: createLeaveTypeSchema.shape.body.partial(),
});

export const leaveTypeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid leave type ID format"),
  }),
});

export const getLeaveTypesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    search: z.string().trim().optional(),
    status: leaveTypeStatusEnum.optional(),
    sortBy: z.enum(["name", "code", "daysAllowedPerYear", "createdAt"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>["body"];
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>["body"];
export type GetLeaveTypesQueryInput = z.infer<typeof getLeaveTypesQuerySchema>["query"];
