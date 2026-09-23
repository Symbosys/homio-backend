import { z } from "zod";

// ==========================================
// LEAD LOST REASON ENUMS
// ==========================================

export const LeadLostReasonGroupEnum = z.enum([
  "PRICING",
  "COMPETITOR",
  "TIMELINE",
  "LOCATION",
  "SCOPE_MISMATCH",
  "COMMUNICATION",
  "OTHER",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const leadLostReasonIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead lost reason ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createLeadLostReasonSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(150),
    slug: z
      .string()
      .max(180)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    group: LeadLostReasonGroupEnum.default("OTHER"),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    requiresRemarks: z.boolean().default(false),
    requiresCompetitor: z.boolean().default(false),

    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateLeadLostReasonSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead lost reason ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    slug: z
      .string()
      .max(180)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    group: LeadLostReasonGroupEnum.optional(),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    requiresRemarks: z.boolean().optional(),
    requiresCompetitor: z.boolean().optional(),

    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getLeadLostReasonsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    group: LeadLostReasonGroupEnum.optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateLeadLostReasonInput = z.infer<typeof createLeadLostReasonSchema>["body"];
export type UpdateLeadLostReasonInput = z.infer<typeof updateLeadLostReasonSchema>["body"];
export type GetLeadLostReasonsQuery = z.infer<typeof getLeadLostReasonsQuerySchema>["query"];
