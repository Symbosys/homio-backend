import { z } from "zod";
import { additionalInformationSchema } from "./labour.validator.js";

/**
 * 1. CREATE LABOUR BOOKING SCHEMA
 */
export const createLabourBookingSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    labourId: z.string().uuid("Invalid labour ID format"),
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200),
    workDescription: z.string().optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    agreedDailyRate: z.coerce.number().positive("Agreed daily rate must be greater than 0"),
    estimatedDays: z.coerce.number().int().positive("Estimated days must be at least 1").default(1),
    status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("CONFIRMED"),
    notes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE LABOUR BOOKING SCHEMA (Symmetric full editability - Rule 19)
 */
export const updateLabourBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    workTitle: z.string().min(2, "Work title must be at least 2 characters").max(200).optional(),
    workDescription: z.string().optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    agreedDailyRate: z.coerce.number().positive().optional(),
    estimatedDays: z.coerce.number().int().positive().optional(),
    totalBudget: z.coerce.number().nonnegative().optional(),
    status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
    notes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. UPDATE BOOKING STATUS SCHEMA
 */
export const updateBookingStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
  body: z.object({
    status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  }),
});

/**
 * 4. BOOKING ID PARAM SCHEMA
 */
export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid booking ID format"),
  }),
});

/**
 * 5. GET ALL BOOKINGS QUERY SCHEMA
 */
export const getLabourBookingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    projectId: z.string().uuid().optional(),
    labourId: z.string().uuid().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }),
});

export type CreateLabourBookingInput = z.infer<typeof createLabourBookingSchema>["body"];
export type UpdateLabourBookingInput = z.infer<typeof updateLabourBookingSchema>["body"];
export type GetLabourBookingsQuery = z.infer<typeof getLabourBookingsQuerySchema>["query"];
