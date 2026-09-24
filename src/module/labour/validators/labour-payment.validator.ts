import { z } from "zod";
import { imageTypeSchema, additionalInformationSchema } from "./labour.validator.js";

/**
 * 1. CREATE LABOUR PAYMENT SCHEMA
 */
export const createLabourPaymentSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    amount: z.coerce.number().positive("Payment amount must be greater than 0"),
    daysCount: z.coerce.number().int().positive("Days count must be at least 1").default(1),
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).default("CASH"),
    transactionRef: z.string().optional().nullable(),
    receiptPhoto: imageTypeSchema.optional().nullable(),
    status: z.enum(["PAID", "PENDING", "CANCELLED"]).default("PAID"),
    remarks: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE LABOUR PAYMENT SCHEMA (Symmetric editability - Rule 19)
 */
export const updateLabourPaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment ID format"),
  }),
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    amount: z.coerce.number().positive().optional(),
    daysCount: z.coerce.number().int().positive().optional(),
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER"]).optional(),
    transactionRef: z.string().optional().nullable(),
    receiptPhoto: imageTypeSchema.optional().nullable(),
    status: z.enum(["PAID", "PENDING", "CANCELLED"]).optional(),
    remarks: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. UPDATE PAYMENT STATUS SCHEMA
 */
export const updatePaymentStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment ID format"),
  }),
  body: z.object({
    status: z.enum(["PAID", "PENDING", "CANCELLED"]),
  }),
});

/**
 * 4. GET ALL PAYMENTS QUERY SCHEMA
 */
export const getLabourPaymentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    labourId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    paymentMethod: z.string().optional(),
    status: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

/**
 * 5. PAYMENT ID PARAM SCHEMA
 */
export const paymentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid payment ID format"),
  }),
});

export type CreateLabourPaymentInput = z.infer<typeof createLabourPaymentSchema>["body"];
export type UpdateLabourPaymentInput = z.infer<typeof updateLabourPaymentSchema>["body"];
export type GetLabourPaymentsQuery = z.infer<typeof getLabourPaymentsQuerySchema>["query"];
