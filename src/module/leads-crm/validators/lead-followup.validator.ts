import { z } from "zod";

/**
 * Follow-up status enum representing scheduling lifecycle
 */
export const FollowUpStatusEnum = z.enum([
  "PENDING",
  "COMPLETED",
  "RESCHEDULED",
  "CANCELLED",
  "MISSED",
]);

/**
 * Follow-up communication and interaction types
 */
export const FollowUpTypeEnum = z.enum([
  "CALLBACK",
  "ONLINE_MEETING",
  "SITE_VISIT",
  "OFFICE_VISIT",
]);

/**
 * Validator for follow-up UUID param
 */
export const followUpIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid follow-up ID format"),
  }),
});

/**
 * Validator for scheduling a new lead follow-up
 */
export const createLeadFollowUpSchema = z.object({
  body: z.object({
    leadId: z.string().uuid("Invalid lead ID format"),
    type: FollowUpTypeEnum.default("CALLBACK").optional(),
    scheduledAt: z.string().datetime({ message: "scheduledAt must be a valid ISO datetime" }),
    remindAt: z.string().datetime().optional().nullable(),
    agenda: z.string().max(500).optional().default("Follow-up"),
    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),
  }),
});

/**
 * Validator for updating follow-up status, rescheduling, or outcome notes
 */
export const updateLeadFollowUpSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid follow-up ID format"),
  }),
  body: z.object({
    type: FollowUpTypeEnum.optional(),
    status: FollowUpStatusEnum.optional(),
    scheduledAt: z.string().datetime().optional(),
    remindAt: z.string().datetime().optional().nullable(),
    agenda: z.string().min(1).max(500).optional(),
    outcomeNotes: z.string().max(2000).optional().nullable(),
    completedAt: z.string().datetime().optional().nullable(),
    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),
  }),
});

/**
 * Validator for querying follow-ups with date range, employee, status, and search filters
 */
export const getFollowUpsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    leadId: z.string().uuid().optional(),
    status: FollowUpStatusEnum.optional(),
    type: FollowUpTypeEnum.optional(),
    assignedToId: z.string().uuid().optional(),
    search: z.string().optional(),
    
    // Date range filters for scheduledAt
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromScheduledAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toScheduledAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),

    sortBy: z.enum(["scheduledAt", "createdAt", "status"]).default("scheduledAt"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type CreateLeadFollowUpInput = z.infer<typeof createLeadFollowUpSchema>["body"];
export type UpdateLeadFollowUpInput = z.infer<typeof updateLeadFollowUpSchema>["body"];
export type GetFollowUpsQueryInput = z.infer<typeof getFollowUpsQuerySchema>["query"];
