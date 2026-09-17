import { z } from "zod";

export const marketplaceTypeEnum = z.enum([
  "DIGITAL_ASSET",
  "HOME_DECOR",
  "PROPERTIES",
  "MATERIALS",
  "OTHER",
]);

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Category name is required"),
    code: z.string().trim().min(1, "Category code is required"),
    slug: z.string().trim().optional(),
    marketplaceType: marketplaceTypeEnum,
    description: z.string().trim().nullable().optional(),
    icon: z.string().trim().nullable().optional(),
    imageUrl: z.union([z.string().trim().url("Invalid image URL"), imageTypeSchema]).nullable().optional(),
    sortOrder: z.coerce.number().int().optional().default(0),
    parentId: z.string().uuid("Invalid parent category ID").nullable().optional(),
    isActive: z.coerce.boolean().optional().default(true),
  }),
});

export const updateCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid category ID format"),
  }),
  body: z.object({
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).optional(),
    slug: z.string().trim().optional(),
    marketplaceType: marketplaceTypeEnum.optional(),
    description: z.string().trim().nullable().optional(),
    icon: z.string().trim().nullable().optional(),
    imageUrl: z.union([z.string().trim().url("Invalid image URL"), imageTypeSchema]).nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    parentId: z.string().uuid("Invalid parent category ID").nullable().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export const getCategoryQuerySchema = z.object({
  query: z.object({
    marketplaceType: marketplaceTypeEnum.optional(),
    parentId: z.string().uuid().optional().nullable(),
    search: z.string().trim().optional(),
    isActive: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Math.max(1, parseInt(val, 10)) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) =>
        val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20,
      ),
  }),
});

export const categoryIdParamSchema = z.object({
  params: z.object({
    id: z.string().trim().min(1, "Category ID or slug is required"),
  }),
});
