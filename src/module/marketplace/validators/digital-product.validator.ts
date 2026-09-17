import { z } from "zod";

export const digitalFileFormatEnum = z.enum([
  "PDF",
  "EPUB",
  "ZIP",
  "DWG",
  "FBX",
  "OTHER",
]);

export const productStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const createDigitalProductSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format"),
    name: z.string().trim().min(1, "Product name is required"),
    sku: z.string().trim().min(1, "SKU is required"),
    urlSlug: z.string().trim().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional().default([]),
    authorName: z.string().trim().nullable().optional(),
    fileUrl: z.string().trim().url("Invalid digital asset file URL").optional().default("https://homio.app/sample.pdf"),
    fileFormat: digitalFileFormatEnum.optional().default("PDF"),
    fileSize: z.string().trim().nullable().optional(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    previewImages: z.array(z.union([z.string().trim(), imageTypeSchema])).optional().default([]),
    downloadLinkExpiryHours: z.number().int().positive().optional().default(48),
    maxDownloads: z.number().int().positive().optional().default(5),
    mrp: z.number().min(0).optional().default(0),
    sellingPrice: z.number().min(0).optional().default(0),
    taxRate: z.number().min(0).max(100).optional().default(18.0),
    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updateDigitalProductSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional(),
    name: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    urlSlug: z.string().trim().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional(),
    authorName: z.string().trim().nullable().optional(),
    fileUrl: z.string().trim().url().optional(),
    fileFormat: digitalFileFormatEnum.optional(),
    fileSize: z.string().trim().nullable().optional(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    previewImages: z.array(z.union([z.string().trim(), imageTypeSchema])).optional(),
    downloadLinkExpiryHours: z.number().int().positive().optional(),
    maxDownloads: z.number().int().positive().optional(),
    mrp: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    status: productStatusEnum.optional(),
    isFeatured: z.boolean().optional(),
  }),
});

export const getDigitalProductsQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    status: productStatusEnum.optional(),
    search: z.string().trim().optional(),
    isFeatured: z
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
      .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10))) : 20)),
  }),
});

export const digitalProductIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
});


