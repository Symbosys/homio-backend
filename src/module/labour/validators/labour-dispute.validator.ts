import { z } from "zod";
import { imageTypeSchema, additionalInformationSchema } from "./labour.validator.js";

/**
 * 1. CREATE LABOUR DISPUTE SCHEMA
 */
export const createLabourDisputeSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    disputeType: z.enum(["NON_PAYMENT", "ABANDONMENT", "QUALITY_BREACH", "SAFETY_VIOLATION", "OTHER"]).default("OTHER"),
    amountInDispute: z.coerce.number().nonnegative().default(0),
    status: z.enum(["OPEN", "UNDER_REVIEW", "NOTICE_SENT", "SETTLED", "CLOSED"]).default("OPEN"),
    initiator: z.enum(["CLIENT", "LABOUR", "CONTRACTOR"]).default("CONTRACTOR"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    resolutionSummary: z.string().optional().nullable(),
    lawyerName: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE LABOUR DISPUTE SCHEMA (Symmetric editability - Rule 19)
 */
export const updateLabourDisputeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    disputeType: z.enum(["NON_PAYMENT", "ABANDONMENT", "QUALITY_BREACH", "SAFETY_VIOLATION", "OTHER"]).optional(),
    amountInDispute: z.coerce.number().nonnegative().optional(),
    status: z.enum(["OPEN", "UNDER_REVIEW", "NOTICE_SENT", "SETTLED", "CLOSED"]).optional(),
    initiator: z.enum(["CLIENT", "LABOUR", "CONTRACTOR"]).optional(),
    reason: z.string().min(5).optional(),
    resolutionSummary: z.string().optional().nullable(),
    lawyerName: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. UPDATE DISPUTE STATUS SCHEMA
 */
export const updateDisputeStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    status: z.enum(["OPEN", "UNDER_REVIEW", "NOTICE_SENT", "SETTLED", "CLOSED"]),
    resolutionSummary: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    lawyerName: z.string().optional().nullable(),
  }),
});

/**
 * 4. GET ALL DISPUTES QUERY SCHEMA
 */
export const getLabourDisputesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    labourId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    disputeType: z.string().optional(),
    status: z.string().optional(),
    initiator: z.string().optional(),
  }),
});

/**
 * 5. DISPUTE ID PARAM SCHEMA
 */
export const disputeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
});

export type CreateLabourDisputeInput = z.infer<typeof createLabourDisputeSchema>["body"];
export type UpdateLabourDisputeInput = z.infer<typeof updateLabourDisputeSchema>["body"];
export type UpdateDisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>["body"];
export type GetLabourDisputesQuery = z.infer<typeof getLabourDisputesQuerySchema>["query"];
