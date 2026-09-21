import { z } from "zod";

// ==========================================
// EXPENSE SCOPE ENUM
// ==========================================

export const ExpenseScopeEnum = z.enum(["PROJECT", "ORGANIZATION", "BOTH"]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const expenseCategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense category ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createExpenseCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    scope: ExpenseScopeEnum.default("PROJECT"),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    isTaxDeductible: z.boolean().default(true),
    isActive: z.boolean().default(true),
  }),
});

export const updateExpenseCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid expense category ID format"),
  }),
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    scope: ExpenseScopeEnum.optional(),
    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),
    isTaxDeductible: z.boolean().optional(),
    isActive: z.boolean().optional(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getExpenseCategoriesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    scope: ExpenseScopeEnum.optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>["body"];
export type UpdateExpenseCategoryInput = z.infer<typeof updateExpenseCategorySchema>["body"];
export type GetExpenseCategoriesQuery = z.infer<typeof getExpenseCategoriesQuerySchema>["query"];
