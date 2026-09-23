import { z } from "zod";

// ==========================================
// COMPLAINT & SNAG ENUMS
// ==========================================

export const ComplaintSnagScopeEnum = z.enum(["SNAG", "COMPLAINT", "BOTH"]);
export const ComplaintSeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const complaintSnagCategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid complaint/snag category ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createComplaintSnagCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(120),
    slug: z
      .string()
      .max(150)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    scope: ComplaintSnagScopeEnum.default("BOTH"),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    defaultSeverity: ComplaintSeverityEnum.default("MEDIUM"),
    defaultResolutionDays: z.coerce.number().int().positive().default(3),

    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateComplaintSnagCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid complaint/snag category ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    slug: z
      .string()
      .max(150)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    scope: ComplaintSnagScopeEnum.optional(),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    defaultSeverity: ComplaintSeverityEnum.optional(),
    defaultResolutionDays: z.coerce.number().int().positive().optional(),

    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getComplaintSnagCategoriesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    scope: ComplaintSnagScopeEnum.optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateComplaintSnagCategoryInput = z.infer<typeof createComplaintSnagCategorySchema>["body"];
export type UpdateComplaintSnagCategoryInput = z.infer<typeof updateComplaintSnagCategorySchema>["body"];
export type GetComplaintSnagCategoriesQuery = z.infer<typeof getComplaintSnagCategoriesQuerySchema>["query"];
