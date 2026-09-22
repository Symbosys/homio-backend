import { z } from "zod";

export const issueResolutionAnswerEnum = z.enum(["YES", "PARTIALLY", "NO"]);

/**
 * Validator schema for creating customer feedback
 */
export const createCustomerFeedbackSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  serviceRequestId: z.string().uuid("Invalid service request ID format").optional().nullable(),
  serviceVisitId: z.string().uuid("Invalid service visit ID format").optional().nullable(),
  touchpoint: z.string().max(100).optional().default("POST_SERVICE"),
  overallRating: z.coerce.number().min(1.0, "Rating must be between 1.0 and 5.0").max(5.0),
  qualityRating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
  timelinessRating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
  professionalismRating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
  communicationRating: z.coerce.number().min(1.0).max(5.0).optional().nullable(),
  issueResolvedAnswer: issueResolutionAnswerEnum.optional().default("YES"),
  whatWentWell: z.string().optional().nullable(),
  whatCouldImprove: z.string().optional().nullable(),
  customerComments: z.string().optional().nullable(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating customer feedback
 */
export const updateCustomerFeedbackSchema = createCustomerFeedbackSchema
  .omit({ projectId: true, serviceRequestId: true, serviceVisitId: true })
  .partial();

/**
 * Validator schema for escalating feedback to management
 */
export const escalateFeedbackSchema = z.object({
  escalationReason: z.string().min(5, "Escalation reason must be at least 5 characters"),
});

/**
 * Validator schema for resolving an escalated feedback
 */
export const resolveEscalationSchema = z.object({
  managerNotes: z.string().min(5, "Manager notes must be at least 5 characters"),
});

export const stringToOptionalBoolean = z.preprocess((val) => {
  if (val === "true" || val === true) return true;
  if (val === "false" || val === false) return false;
  return undefined;
}, z.boolean().optional());

/**
 * Validator schema for listing customer feedbacks
 */
export const getCustomerFeedbacksQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  serviceVisitId: z.string().uuid().optional(),
  minRating: z.coerce.number().min(1.0).max(5.0).optional(),
  maxRating: z.coerce.number().min(1.0).max(5.0).optional(),
  isEscalated: stringToOptionalBoolean,
  isResolved: stringToOptionalBoolean,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for feedback ID param
 */
export const feedbackIdParamSchema = z.object({
  id: z.string().uuid("Invalid feedback ID format"),
});

export type CreateCustomerFeedbackInput = z.infer<typeof createCustomerFeedbackSchema>;
export type UpdateCustomerFeedbackInput = z.infer<typeof updateCustomerFeedbackSchema>;
export type EscalateFeedbackInput = z.infer<typeof escalateFeedbackSchema>;
export type ResolveEscalationInput = z.infer<typeof resolveEscalationSchema>;
export type GetCustomerFeedbacksQueryInput = z.infer<typeof getCustomerFeedbacksQuerySchema>;
