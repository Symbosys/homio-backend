import { z } from "zod";

export const shiftStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createShiftSchema = z.object({
  body: z.object({
    name: z.string({ message: "Shift name is required" }).trim().min(1, "Name cannot be empty").max(100),
    code: z.string().trim().min(1).max(30).toUpperCase().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    startTime: z
      .string({ message: "Start time is required" })
      .trim()
      .regex(timeRegex, "Start time must be in HH:mm 24-hour format (e.g. 09:00)"),
    endTime: z
      .string({ message: "End time is required" })
      .trim()
      .regex(timeRegex, "End time must be in HH:mm 24-hour format (e.g. 18:00)"),
    lateGraceMinutes: z.coerce.number().int().min(0, "Late grace minutes cannot be negative").max(240).default(15),
    earlyExitGraceMinutes: z.coerce.number().int().min(0, "Early exit grace minutes cannot be negative").max(240).default(0),
    halfDayThresholdMinutes: z.coerce.number().int().min(30, "Half day threshold must be at least 30 minutes").max(720).default(240),
    fullDayThresholdMinutes: z.coerce.number().int().min(60, "Full day threshold must be at least 60 minutes").max(1440).default(480),
    isNightShift: z.boolean().default(false).optional(),
    workDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "At least one work day must be selected").default([1, 2, 3, 4, 5]),
    status: shiftStatusEnum.default("ACTIVE").optional(),
  }),
});

export const updateShiftSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
  body: createShiftSchema.shape.body.partial(),
});

export const shiftIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
});

export const getShiftsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: shiftStatusEnum.optional(),
    sortBy: z.enum(["createdAt", "name", "code", "startTime", "endTime"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export const assignEmployeesToShiftSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid shift ID format"),
  }),
  body: z.object({
    employeeIds: z.array(z.string().uuid("Invalid employee ID")).min(1, "At least one employee ID is required"),
  }),
});

export const unassignEmployeeFromShiftSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
  }),
});

export type CreateShiftInput = z.infer<typeof createShiftSchema>["body"];
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>["body"];
export type GetShiftsQueryInput = z.infer<typeof getShiftsQuerySchema>["query"];
export type AssignEmployeesToShiftInput = z.infer<typeof assignEmployeesToShiftSchema>["body"];
