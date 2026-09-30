import { z } from "zod";
import {
  FunnelCategory,
  FunnelStageType,
  DynamicFormFieldType,
} from "../../../types/types.js";

// ==========================================
// ZOD ENUMS DIRECTLY BOUND TO PRISMA
// ==========================================

export const FunnelCategoryEnum = z.nativeEnum(FunnelCategory);
export const FunnelStageTypeEnum = z.nativeEnum(FunnelStageType);
export const DynamicFormFieldTypeEnum = z.nativeEnum(DynamicFormFieldType);

// ==========================================
// 1. LEAD FUNNEL VALIDATORS
// ==========================================

/**
 * Validator: Create Lead Funnel
 */
export const createLeadFunnelSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(150),
    slug: z
      .string()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().max(2000).optional(),
    funnelCategory: FunnelCategoryEnum.default(FunnelCategory.CLIENT),
    embedSlug: z
      .string()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9-]+$/, "Embed slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
    color: z.string().max(50).optional(),
    additionalInformation: z.record(z.string(), z.any()).optional(),
  }),
});

export type CreateLeadFunnelInput = z.infer<typeof createLeadFunnelSchema>["body"];

/**
 * Validator: Update Lead Funnel
 */
export const updateLeadFunnelSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(2000).optional().nullable(),
    funnelCategory: FunnelCategoryEnum.optional(),
    embedSlug: z
      .string()
      .min(2)
      .max(180)
      .regex(/^[a-z0-9-]+$/, "Embed slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    color: z.string().max(50).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export type UpdateLeadFunnelInput = z.infer<typeof updateLeadFunnelSchema>["body"];

/**
 * Validator: Query Lead Funnels
 */
export const getLeadFunnelsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    funnelCategory: FunnelCategoryEnum.optional(),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((val) => (val !== undefined ? val === "true" : undefined)),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    sortBy: z.enum(["sortOrder", "name", "createdAt"]).default("sortOrder"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type GetLeadFunnelsQueryInput = z.infer<typeof getLeadFunnelsQuerySchema>["query"];

// ==========================================
// 2. FUNNEL STAGE VALIDATORS
// ==========================================

/**
 * Validator: Create Funnel Stage
 */
export const createFunnelStageSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Stage name is required").max(120),
    slug: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase alphanumeric characters and hyphens")
      .optional(),
    orderIndex: z.number().int().nonnegative().optional(),
    stageType: FunnelStageTypeEnum.default(FunnelStageType.QUALIFYING),
    slaTargetDescription: z.string().max(255).optional().nullable(),
    slaHours: z.number().int().nonnegative().optional().nullable(),
    autoTaskEnabled: z.boolean().default(false),
    autoTaskTitle: z.string().max(200).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    winProbability: z.number().min(0).max(100).default(0),
    isActive: z.boolean().default(true),
    additionalInformation: z.record(z.string(), z.any()).optional(),
  }),
});

export type CreateFunnelStageInput = z.infer<typeof createFunnelStageSchema>["body"];

/**
 * Validator: Update Funnel Stage
 */
export const updateFunnelStageSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    slug: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    orderIndex: z.number().int().nonnegative().optional(),
    stageType: FunnelStageTypeEnum.optional(),
    slaTargetDescription: z.string().max(255).optional().nullable(),
    slaHours: z.number().int().nonnegative().optional().nullable(),
    autoTaskEnabled: z.boolean().optional(),
    autoTaskTitle: z.string().max(200).optional().nullable(),
    color: z.string().max(50).optional().nullable(),
    winProbability: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export type UpdateFunnelStageInput = z.infer<typeof updateFunnelStageSchema>["body"];

/**
 * Validator: Reorder Stages
 */
export const reorderStagesSchema = z.object({
  body: z.object({
    stages: z.array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().nonnegative(),
      })
    ).min(1),
  }),
});

export type ReorderStagesInput = z.infer<typeof reorderStagesSchema>["body"];

// ==========================================
// 3. DYNAMIC FORM BUILDER VALIDATORS
// ==========================================

/**
 * Validator: Create Dynamic Form Field
 */
export const createFormFieldSchema = z.object({
  body: z.object({
    label: z.string().min(1, "Label is required").max(150),
    key: z
      .string()
      .min(1, "Key is required")
      .max(120)
      .regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, and underscores"),
    fieldType: DynamicFormFieldTypeEnum.default(DynamicFormFieldType.TEXT),
    isRequired: z.boolean().default(false),
    placeholder: z.string().max(200).optional().nullable(),
    helpText: z.string().max(255).optional().nullable(),
    options: z.array(z.string()).default([]),
    orderIndex: z.number().int().default(0),
    isActive: z.boolean().default(true),
    additionalInformation: z.record(z.string(), z.any()).optional(),
  }),
});

export type CreateFormFieldInput = z.infer<typeof createFormFieldSchema>["body"];

/**
 * Validator: Update Dynamic Form Field
 */
export const updateFormFieldSchema = z.object({
  body: z.object({
    label: z.string().min(1).max(150).optional(),
    key: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9_]+$/)
      .optional(),
    fieldType: DynamicFormFieldTypeEnum.optional(),
    isRequired: z.boolean().optional(),
    placeholder: z.string().max(200).optional().nullable(),
    helpText: z.string().max(255).optional().nullable(),
    options: z.array(z.string()).optional(),
    orderIndex: z.number().int().optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export type UpdateFormFieldInput = z.infer<typeof updateFormFieldSchema>["body"];

/**
 * Validator: Reorder Form Fields
 */
export const reorderFormFieldsSchema = z.object({
  body: z.object({
    fields: z.array(
      z.object({
        id: z.string().uuid(),
        orderIndex: z.number().int().nonnegative(),
      })
    ).min(1),
  }),
});

export type ReorderFormFieldsInput = z.infer<typeof reorderFormFieldsSchema>["body"];

// ==========================================
// 4. PUBLIC EMBED FORM SUBMISSION VALIDATOR
// ==========================================

/**
 * Validator: Public Lead Ingestion from Embedded Form
 */
export const submitPublicLeadSchema = z.object({
  body: z.object({
    formData: z.record(z.string(), z.any()), // Map of dynamic form key-value pairs
    clientName: z.string().min(1, "Name is required").optional(),
    phone: z.string().min(5, "Contact phone is required").optional(),
    email: z.string().email().optional(),
    notes: z.string().max(2000).optional(),
    sourceUrl: z.string().url().optional(),
    referrer: z.string().optional(),
  }),
});

export type SubmitPublicLeadInput = z.infer<typeof submitPublicLeadSchema>["body"];

// ==========================================
// 5. STAGE TRANSITION & INQUIRY VALIDATORS
// ==========================================

/**
 * Validator: Transition Lead Funnel Stage
 */
export const transitionFunnelLeadStageSchema = z.object({
  body: z.object({
    toStageId: z.string().uuid("Target stage ID must be a valid UUID"),
    transitionReason: z.string().max(255).optional().nullable(),
    transitionNote: z.string().max(2000).optional().nullable(),
    remarks: z.string().max(1000).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export type TransitionFunnelLeadStageInput = z.infer<typeof transitionFunnelLeadStageSchema>["body"];

/**
 * Validator: Query Funnel Inquiries / Leads
 */
export const getFunnelLeadsQuerySchema = z.object({
  query: z.object({
    stageId: z.string().uuid().optional(),
    isSlaBreached: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((val) => (typeof val === "boolean" ? val : val !== undefined ? val === "true" : undefined)),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    sortBy: z.enum(["createdAt", "stageEnteredAt", "title", "leadCode"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type GetFunnelLeadsQueryInput = z.infer<typeof getFunnelLeadsQuerySchema>["query"];

/**
 * Validator: Query Stage Transitions & Audit Log
 */
export const getFunnelTransitionsQuerySchema = z.object({
  query: z.object({
    leadId: z.string().uuid().optional(),
    isSlaBreached: z
      .union([z.boolean(), z.enum(["true", "false"])])
      .optional()
      .transform((val) => (typeof val === "boolean" ? val : val !== undefined ? val === "true" : undefined)),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
  }),
});

export type GetFunnelTransitionsQueryInput = z.infer<typeof getFunnelTransitionsQuerySchema>["query"];
