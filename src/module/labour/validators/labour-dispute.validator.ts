import { z } from "zod";
import { imageTypeSchema, additionalInformationSchema } from "./labour.validator.js";

export const DISPUTE_TYPE_ENUM = [
  "WORK_ABANDONMENT_BY_LABOUR",
  "NON_PAYMENT_BY_CLIENT",
  "BYPASS_ATTEMPT",
  "QUALITY_BREACH",
  "SAFETY_VIOLATION",
  "NON_PAYMENT",
  "ABANDONMENT",
  "OFF_PLATFORM_BYPASS",
  "PAYMENT_DEFAULT",
  "WORK_ABANDONMENT",
  "OTHER",
] as const;

/**
 * 1. CREATE LABOUR DISPUTE SCHEMA
 */
export const createLabourDisputeSchema = z.object({
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format"),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    disputeType: z.enum(DISPUTE_TYPE_ENUM).default("OTHER"),
    amountInDispute: z.coerce.number().nonnegative().default(0),
    status: z.enum(["OPEN", "UNDER_REVIEW", "NOTICE_SENT", "SETTLED", "CLOSED"]).default("OPEN"),
    initiator: z.enum(["CLIENT", "LABOUR", "CONTRACTOR", "PLATFORM_SYSTEM"]).default("CLIENT"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    resolutionSummary: z.string().optional().nullable(),
    lawyerName: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. REPORT OFF-PLATFORM CASH BYPASS SCHEMA
 */
export const reportBypassAttemptSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format"),
    reportedRole: z.enum(["CLIENT", "LABOUR", "CONTRACTOR"]),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
  }),
});

/**
 * 3. REPORT CLIENT PAYMENT DUE / DEFAULT SCHEMA
 */
export const reportClientPaymentDueSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format"),
    amountInDispute: z.coerce.number().positive("Unpaid amount must be greater than 0"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
  }),
});

/**
 * 4. REPORT LABOUR WORK ABANDONMENT SCHEMA
 */
export const reportLabourAbandonmentSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    evidenceDocs: z.array(imageTypeSchema).optional().nullable(),
  }),
});

/**
 * 5. ASSIGN EMPANELLED LAWYER SCHEMA
 */
export const assignEmpanelledLawyerSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    lawyerName: z.string().min(2, "Lawyer name is required"),
    lawyerPhone: z.string().min(5, "Lawyer phone number is required"),
    lawyerBarCouncilNo: z.string().optional().nullable(),
  }),
});

/**
 * 6. RECORD LEGAL NOTICE SCHEMA
 */
export const recordLegalNoticeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    legalNoticeDoc: imageTypeSchema.optional().nullable(),
    noticeSummary: z.string().optional().nullable(),
  }),
});

/**
 * 7. RECORD LABOUR COURT ACTION SCHEMA
 */
export const recordLabourCourtActionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    labourCourtCaseNo: z.string().min(2, "Labour court case number is required"),
    labourCourtDate: z.coerce.date().optional(),
    actionSummary: z.string().optional().nullable(),
  }),
});

/**
 * 8. UPDATE LABOUR DISPUTE SCHEMA (Symmetric editability - Rule 19)
 */
export const updateLabourDisputeSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    bookingId: z.string().uuid("Invalid booking ID format").optional().nullable(),
    disputeType: z.enum(DISPUTE_TYPE_ENUM).optional(),
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
 * 9. UPDATE DISPUTE STATUS SCHEMA
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
 * 10. GET ALL DISPUTES QUERY SCHEMA
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
 * 11. DISPUTE ID PARAM SCHEMA
 */
export const disputeIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
});

export type CreateLabourDisputeInput = z.infer<typeof createLabourDisputeSchema>["body"];
export type ReportBypassAttemptInput = z.infer<typeof reportBypassAttemptSchema>["body"];
export type ReportClientPaymentDueInput = z.infer<typeof reportClientPaymentDueSchema>["body"];
export type ReportLabourAbandonmentInput = z.infer<typeof reportLabourAbandonmentSchema>["body"];
export type AssignEmpanelledLawyerInput = z.infer<typeof assignEmpanelledLawyerSchema>["body"];
export type RecordLegalNoticeInput = z.infer<typeof recordLegalNoticeSchema>["body"];
export type RecordLabourCourtActionInput = z.infer<typeof recordLabourCourtActionSchema>["body"];
export type UpdateLabourDisputeInput = z.infer<typeof updateLabourDisputeSchema>["body"];
export type UpdateDisputeStatusInput = z.infer<typeof updateDisputeStatusSchema>["body"];
export type GetLabourDisputesQuery = z.infer<typeof getLabourDisputesQuerySchema>["query"];
