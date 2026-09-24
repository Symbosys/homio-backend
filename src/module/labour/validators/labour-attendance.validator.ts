import { z } from "zod";
import { additionalInformationSchema } from "./labour.validator.js";

/**
 * 1. PUNCH IN SCHEMA
 */
export const punchInSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    projectSiteId: z.string().uuid("Invalid project site ID format"),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    attendanceDate: z.coerce.date().optional(),
    punchInLat: z.coerce.number(),
    punchInLng: z.coerce.number(),
    punchInAddress: z.string().optional().nullable(),
    workNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. PUNCH OUT SCHEMA
 */
export const punchOutSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
  body: z.object({
    punchOutLat: z.coerce.number(),
    punchOutLng: z.coerce.number(),
    punchOutAddress: z.string().optional().nullable(),
    workNotes: z.string().optional().nullable(),
  }),
});

/**
 * 3. MANUAL / SUPERVISOR ATTENDANCE CREATE SCHEMA
 */
export const createManualAttendanceSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    projectSiteId: z.string().uuid("Invalid project site ID format"),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    attendanceDate: z.coerce.date(),
    status: z.enum(["PRESENT", "HALF_DAY", "OVERTIME", "ABSENT", "PENDING_APPROVAL", "GEO_MISMATCH"]).default("PRESENT"),
    punchInTime: z.coerce.date().optional().nullable(),
    punchOutTime: z.coerce.date().optional().nullable(),
    hoursWorked: z.coerce.number().min(0).max(24).optional().nullable(),
    dayWage: z.coerce.number().min(0).optional(),
    workNotes: z.string().optional().nullable(),
    supervisorApproved: z.boolean().default(true),
    supervisorNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 4. UPDATE ATTENDANCE SCHEMA (Symmetric full editability - Rule 19)
 */
export const updateAttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    projectSiteId: z.string().uuid("Invalid project site ID format").optional(),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    attendanceDate: z.coerce.date().optional(),
    status: z.enum(["PRESENT", "HALF_DAY", "OVERTIME", "ABSENT", "PENDING_APPROVAL", "GEO_MISMATCH"]).optional(),
    punchInTime: z.coerce.date().optional().nullable(),
    punchOutTime: z.coerce.date().optional().nullable(),
    punchInLat: z.coerce.number().optional().nullable(),
    punchInLng: z.coerce.number().optional().nullable(),
    punchOutLat: z.coerce.number().optional().nullable(),
    punchOutLng: z.coerce.number().optional().nullable(),
    hoursWorked: z.coerce.number().min(0).max(24).optional().nullable(),
    dayWage: z.coerce.number().min(0).optional(),
    workNotes: z.string().optional().nullable(),
    supervisorApproved: z.boolean().optional(),
    supervisorNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 5. SUPERVISOR APPROVAL SCHEMA
 */
export const approveAttendanceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
  body: z.object({
    supervisorApproved: z.boolean().default(true),
    status: z.enum(["PRESENT", "HALF_DAY", "OVERTIME", "ABSENT", "GEO_MISMATCH"]).default("PRESENT"),
    supervisorNotes: z.string().optional().nullable(),
    dayWage: z.coerce.number().min(0).optional(),
  }),
});

/**
 * 6. ATTENDANCE QUERY SCHEMA
 */
export const getAttendancesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    projectSiteId: z.string().uuid().optional(),
    labourId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    status: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    supervisorApproved: z.preprocess((val) => {
      if (val === "true") return true;
      if (val === "false") return false;
      return val;
    }, z.boolean().optional()),
  }),
});

/**
 * 7. ATTENDANCE ID PARAM SCHEMA
 */
export const attendanceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid attendance ID format"),
  }),
});

export type PunchInInput = z.infer<typeof punchInSchema>["body"];
export type PunchOutInput = z.infer<typeof punchOutSchema>["body"];
export type CreateManualAttendanceInput = z.infer<typeof createManualAttendanceSchema>["body"];
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>["body"];
export type ApproveAttendanceInput = z.infer<typeof approveAttendanceSchema>["body"];
export type GetAttendancesQuery = z.infer<typeof getAttendancesQuerySchema>["query"];
