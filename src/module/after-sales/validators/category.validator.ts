import { z } from "zod";

/**
 * Validator schema for creating a service category
 */
export const createServiceCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  slug: z.string().min(2).max(120).optional(),
  code: z.string().max(50).optional(),
  description: z.string().optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  defaultSlaHours: z.coerce.number().int().positive().optional().default(48),
  isDefault: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating a service category (dirty fields)
 */
export const updateServiceCategorySchema = createServiceCategorySchema.partial();

export const stringToOptionalBoolean = z.preprocess((val) => {
  if (val === "true" || val === true) return true;
  if (val === "false" || val === false) return false;
  return undefined;
}, z.boolean().optional());

/**
 * Validator schema for listing service categories
 */
export const getServiceCategoriesQuerySchema = z.object({
  search: z.string().optional(),
  isActive: stringToOptionalBoolean,
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for category ID param
 */
export const categoryIdParamSchema = z.object({
  id: z.string().uuid("Invalid category ID format"),
});

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;
export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;
export type GetServiceCategoriesQueryInput = z.infer<typeof getServiceCategoriesQuerySchema>;
