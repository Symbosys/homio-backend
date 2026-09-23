import { z } from "zod";

// ==========================================
// TASK CATEGORY ENUMS
// ==========================================

export const TaskCategoryScopeEnum = z.enum(["LEAD", "PROJECT", "CUSTOMER", "GENERAL", "ALL"]);
export const TaskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const taskCategoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task category ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createTaskCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    scope: TaskCategoryScopeEnum.default("ALL"),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    defaultPriority: TaskPriorityEnum.default("MEDIUM"),
    defaultEstimatedHours: z.coerce.number().positive().optional().nullable(),

    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTaskCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task category ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens")
      .optional(),
    code: z.string().max(50).optional().nullable(),
    scope: TaskCategoryScopeEnum.optional(),
    description: z.string().max(2000).optional().nullable(),

    color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid HEX color format").optional().nullable(),
    icon: z.string().max(50).optional().nullable(),

    defaultPriority: TaskPriorityEnum.optional(),
    defaultEstimatedHours: z.coerce.number().positive().optional().nullable(),

    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),

    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getTaskCategoriesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    search: z.string().optional(),
    scope: TaskCategoryScopeEnum.optional(),
    isActive: z.preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  }),
});

export type CreateTaskCategoryInput = z.infer<typeof createTaskCategorySchema>["body"];
export type UpdateTaskCategoryInput = z.infer<typeof updateTaskCategorySchema>["body"];
export type GetTaskCategoriesQuery = z.infer<typeof getTaskCategoriesQuerySchema>["query"];
