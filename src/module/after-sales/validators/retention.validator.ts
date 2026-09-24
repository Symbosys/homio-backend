import { z } from "zod";

export const retentionFollowUpTypeEnum = z.enum([
  "COURTESY_CALL_30_DAYS",
  "CHECK_IN_60_DAYS",
  "FIRST_QUARTER_REVIEW",
  "BI_ANNUAL_CHECK_IN",
  "ANNUAL_WARRANTY_RENEWAL",
  "MAINTENANCE_CONTRACT_PITCH",
  "GENERAL_CHECK_IN",
]);

export const followUpChannelEnum = z.enum([
  "PHONE_CALL",
  "WHATSAPP",
  "EMAIL",
  "SITE_VISIT",
  "IN_PERSON_MEETING",
]);

export const retentionOutcomeEnum = z.enum([
  "VERY_SATISFIED",
  "SATISFIED",
  "NEUTRAL",
  "DISSATISFIED",
  "REQUIRES_ATTENTION",
  "CONVERTED_TO_SERVICE_REQUEST",
  "NEW_LEAD_REFERRAL",
  "UNREACHABLE",
]);

/**
 * Validator schema for scheduling a retention follow-up
 */
export const createRetentionFollowUpSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  followUpType: retentionFollowUpTypeEnum.optional().default("COURTESY_CALL_30_DAYS"),
  channel: followUpChannelEnum.optional().default("PHONE_CALL"),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid scheduledDate format"),
  assignedEmployeeId: z.string().uuid("Invalid employee ID format").optional().nullable(),
  objective: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating a retention follow-up
 */
export const updateRetentionFollowUpSchema = createRetentionFollowUpSchema.partial();

/**
 * Validator schema for logging a completed retention call
 */
export const logRetentionCallSchema = z.object({
  conductedAt: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid conductedAt format").optional(),
  notes: z.string().min(2, "Call notes are required"),
  outcome: retentionOutcomeEnum,
  nextFollowUpDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid nextFollowUpDate").optional().nullable(),
  csatScore: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
  reviewLinkSent: z.coerce.boolean().optional(),
  reviewPosted: z.coerce.boolean().optional(),
  referralLeadName: z.string().max(255).optional().nullable(),
  referralLeadPhone: z.string().max(50).optional().nullable(),
  referralLeadEmail: z.string().email().optional().nullable(),
});

/**
 * Validator schema for listing retention follow-ups
 */
export const getRetentionFollowUpsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  assignedEmployeeId: z.string().uuid().optional(),
  followUpType: retentionFollowUpTypeEnum.optional(),
  channel: followUpChannelEnum.optional(),
  outcome: retentionOutcomeEnum.optional(),
  scheduledDate: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for retention follow-up ID param
 */
export const retentionIdParamSchema = z.object({
  id: z.string().uuid("Invalid retention ID format"),
});

export type CreateRetentionFollowUpInput = z.infer<typeof createRetentionFollowUpSchema>;
export type UpdateRetentionFollowUpInput = z.infer<typeof updateRetentionFollowUpSchema>;
export type LogRetentionCallInput = z.infer<typeof logRetentionCallSchema>;
export type GetRetentionFollowUpsQueryInput = z.infer<typeof getRetentionFollowUpsQuerySchema>;
