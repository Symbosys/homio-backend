import { z } from "zod";

export const digitalFileFormatEnum = z.enum([
  "PDF",
  "EPUB",
  "ZIP",
  "DWG",
  "DXF",
  "RVT",
  "SKP",
  "OBJ",
  "FBX",
  "DOCX",
  "XLSX",
  "OTHER",
]);

export const productStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const stringToNumber = (defaultVal = 0) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().optional().default(defaultVal));

const stringToBoolean = (defaultVal = false) =>
  z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional().default(defaultVal));

const stringToArray = z.preprocess((val) => {
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return val;
}, z.array(z.string()).optional().default([]));

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
    tags: stringToArray,
    authorName: z.string().trim().nullable().optional(),
    fileUrl: z.string().trim().optional().default("https://homio.app/sample.pdf"),
    fileFormat: digitalFileFormatEnum.optional().default("PDF"),
    fileSize: z.string().trim().nullable().optional(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema, z.any()]).nullable().optional(),
    previewImages: z.any().nullable().optional(),
    downloadLinkExpiryHours: stringToNumber(48),
    maxDownloads: stringToNumber(5),
    mrp: stringToNumber(0),
    sellingPrice: stringToNumber(0),
    taxRate: stringToNumber(18.0),
    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: stringToBoolean(false),
    rating: stringToNumber(0.0),
    reviewsCount: stringToNumber(0),
    totalPurchases: stringToNumber(0),
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
    tags: stringToArray.optional(),
    authorName: z.string().trim().nullable().optional(),
    fileUrl: z.string().trim().optional(),
    fileFormat: digitalFileFormatEnum.optional(),
    fileSize: z.string().trim().nullable().optional(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema, z.any()]).nullable().optional(),
    previewImages: z.any().nullable().optional(),
    downloadLinkExpiryHours: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().positive().optional()),
    maxDownloads: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().positive().optional()),
    mrp: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).optional()),
    sellingPrice: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).optional()),
    taxRate: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).max(100).optional()),
    status: productStatusEnum.optional(),
    isFeatured: z.preprocess((val) => (val === "true" || val === true ? true : val === "false" || val === false ? false : undefined), z.boolean().optional()),
    rating: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).max(5).optional()),
    reviewsCount: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().min(0).optional()),
    totalPurchases: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().min(0).optional()),
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
