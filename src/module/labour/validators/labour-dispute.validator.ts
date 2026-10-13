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

export const DISPUTE_STATUS_ENUM = [
  "OPEN",
  "UNDER_REVIEW",
  "LAWYER_ASSIGNED",
  "NOTICE_SENT",
  "LABOUR_COURT_FILED",
  "SETTLED",
  "CLOSED",
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
    status: z.enum(DISPUTE_STATUS_ENUM).default("OPEN"),
    initiator: z.enum(["CLIENT", "LABOUR", "CONTRACTOR", "PLATFORM_SYSTEM"]).default("CLIENT"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    resolutionSummary: z.string().optional().nullable(),
    lawyerName: z.string().optional().nullable(),
    lawyerPhone: z.string().optional().nullable(),
    lawyerEmail: z.string().optional().nullable(),
    lawyerBarCouncilNo: z.string().optional().nullable(),
    legalNoticeRef: z.string().optional().nullable(),
    legalNoticeDoc: imageTypeSchema.optional().nullable(),
    labourCourtCaseNo: z.string().optional().nullable(),
    labourCourtLocation: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    evidenceDocs: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(imageTypeSchema).optional().nullable()),
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
    evidenceDocs: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(imageTypeSchema).optional().nullable()),
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
    evidenceDocs: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(imageTypeSchema).optional().nullable()),
  }),
});

/**
 * 4. REPORT LABOUR WORK ABANDONMENT SCHEMA
 */
export const reportLabourAbandonmentSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format"),
    reason: z.string().min(5, "Reason must be at least 5 characters"),
    evidenceDocs: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(imageTypeSchema).optional().nullable()),
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
    status: z.enum(DISPUTE_STATUS_ENUM).optional(),
    initiator: z.enum(["CLIENT", "LABOUR", "CONTRACTOR", "PLATFORM_SYSTEM"]).optional(),
    reason: z.string().min(5).optional(),
    resolutionSummary: z.string().optional().nullable(),
    lawyerAssigned: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    lawyerName: z.string().optional().nullable(),
    lawyerPhone: z.string().optional().nullable(),
    lawyerEmail: z.string().optional().nullable(),
    lawyerBarCouncilNo: z.string().optional().nullable(),
    lawyerAssignedAt: z.coerce.date().optional().nullable(),
    legalNoticeSent: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    legalNoticeRef: z.string().optional().nullable(),
    legalNoticeSentAt: z.coerce.date().optional().nullable(),
    legalNoticeDate: z.coerce.date().optional().nullable(),
    legalNoticeDoc: imageTypeSchema.optional().nullable(),
    labourCourtFiled: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    labourCourtCaseNo: z.string().optional().nullable(),
    labourCourtFilingDate: z.coerce.date().optional().nullable(),
    labourCourtDate: z.coerce.date().optional().nullable(),
    labourCourtLocation: z.string().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    actionTaken: z.string().optional().nullable(),
    evidenceDocs: z.preprocess((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(imageTypeSchema).optional().nullable()),
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
    status: z.enum(DISPUTE_STATUS_ENUM),
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

/**
 * 12. TAKE DISPUTE ACTION SCHEMA (PLATFORM ADMIN ACTIONS)
 */
export const DISPUTE_ACTION_ENUM = [
  "CLIENT_RATING_DOWN",
  "CLIENT_BLACKLISTED",
  "LABOUR_WARNED",
  "LABOUR_BLACKLISTED",
  "LABOUR_RATING_DOWN",
  "LEGAL_ACTION",
] as const;

export const takeDisputeActionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid dispute ID format"),
  }),
  body: z.object({
    action: z.enum(DISPUTE_ACTION_ENUM),
    // CLIENT_RATING_DOWN
    clientRating: z.coerce.number().min(1.0).max(5.0).optional(),
    ratingDeduction: z.coerce.number().positive().optional(),
    // CLIENT_BLACKLISTED / LABOUR_BLACKLISTED
    blacklistReason: z.string().min(3).optional(),
    // LABOUR_WARNED
    warningMessage: z.string().min(3).optional(),
    // LABOUR_RATING_DOWN
    labourRating: z.coerce.number().min(1.0).max(5.0).optional(),
    // LEGAL_ACTION
    lawyerAssigned: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    lawyerName: z.string().optional().nullable(),
    lawyerPhone: z.string().optional().nullable(),
    lawyerBarCouncilNo: z.string().optional().nullable(),
    lawyerAssignedAt: z.coerce.date().optional().nullable(),
    legalNoticeSent: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    legalNoticeDate: z.coerce.date().optional().nullable(),
    legalNoticeDoc: imageTypeSchema.optional().nullable(),
    labourCourtFiled: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
    labourCourtCaseNo: z.string().optional().nullable(),
    labourCourtDate: z.coerce.date().optional().nullable(),
    hearingDate: z.coerce.date().optional().nullable(),
    notes: z.string().optional().nullable(),
    resolutionSummary: z.string().optional().nullable(),
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
export type TakeDisputeActionInput = z.infer<typeof takeDisputeActionSchema>["body"];
