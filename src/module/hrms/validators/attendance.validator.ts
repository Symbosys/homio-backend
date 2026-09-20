import { z } from "zod";

export const attendanceStatusEnum = z.enum([
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEK_OFF",
]);

const dateStringSchema = z
  .string({ message: "Date is required" })
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"));

const optionalDateStringSchema = z
  .string()
  .optional()
  .transform((val) => (val && typeof val === "string" && val.includes("T") ? val.split("T")[0] : val))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional());

export const punchInSchema = z.object({
  body: z.object({
    latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
    address: z.string().trim().nullable().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  }),
});

export const punchOutSchema = z.object({
  body: z.object({
    latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
    longitude: z.coerce.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
    address: z.string().trim().nullable().optional(),
    remarks: z.string().trim().max(500).nullable().optional(),
  }),
});

export const getAttendancesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    date: optionalDateStringSchema,
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
    employeeId: z.string().uuid("Invalid employee ID").optional(),
    departmentId: z.string().uuid("Invalid department ID").optional(),
    shiftId: z.string().uuid("Invalid shift ID").optional(),
    status: attendanceStatusEnum.optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["attendanceDate", "createdAt", "punchInTime"]).default("attendanceDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const getMyAttendanceQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    startDate: optionalDateStringSchema,
    endDate: optionalDateStringSchema,
    status: attendanceStatusEnum.optional(),
  }),
});

export const attendanceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
});

export const dailySummaryQuerySchema = z.object({
  query: z.object({
    date: optionalDateStringSchema,
  }),
});

export const regularizeAttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
  body: z.object({
    punchInTime: z.string().datetime({ message: "Invalid ISO date-time string for punchInTime" }).nullable().optional(),
    punchOutTime: z.string().datetime({ message: "Invalid ISO date-time string for punchOutTime" }).nullable().optional(),
    status: attendanceStatusEnum.optional(),
    remarks: z.string().trim().min(1, "Remarks are required for attendance regularization").max(500),
  }),
});

export type PunchInInput = z.infer<typeof punchInSchema>["body"];
export type PunchOutInput = z.infer<typeof punchOutSchema>["body"];
export type GetAttendancesQueryInput = z.infer<typeof getAttendancesQuerySchema>["query"];
export type GetMyAttendanceQueryInput = z.infer<typeof getMyAttendanceQuerySchema>["query"];
export type RegularizeAttendanceInput = z.infer<typeof regularizeAttendanceSchema>["body"];
