import { z } from "zod";

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const serviceCategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid service category ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createServiceCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),

    icon: z.string().max(50).optional().nullable(),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),

    defaultSlaHours: z.coerce.number().int().positive().default(48).optional().nullable(),

    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateServiceCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid service category ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),

    icon: z.string().max(50).optional().nullable(),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),

    defaultSlaHours: z.coerce.number().int().positive().optional().nullable(),

    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getServiceCategoriesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>["body"];
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>["body"];
export type GetServiceCategoriesQuery = z.infer<typeof getServiceCategoriesQuerySchema>["query"];
