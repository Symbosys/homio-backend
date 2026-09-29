import { z } from "zod";
import { QuotationItemCategory } from "../../../types/types.js";

/**
 * Zod NativeEnum for Quotation Item Categories strictly mapped from Prisma schema
 */
export const QuotationItemCategoryEnum = z.nativeEnum(QuotationItemCategory);

/**
 * Validator schema for item master ID URL parameters
 */
export const quotationItemIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Quotation Item ID format"),
  }),
});

/**
 * Validator schema for gallery image deletion URL parameters
 */
export const quotationItemGalleryParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Quotation Item ID format"),
    imageId: z.string().min(1, "Image ID is required"),
  }),
});

/**
 * Structured ImageType validator matching storage service object
 */
export const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string().url("Invalid image URL"),
  bytes: z.number().nonnegative(),
  format: z.string(),
  provider: z.string(),
});

/**
 * Validator schema for creating a single quotation item master
 */
export const createQuotationItemSchema = z.object({
  body: z.object({
    sku: z.string().min(1, "SKU is required").max(100, "SKU cannot exceed 100 characters"),
    name: z.string().min(1, "Item name is required").max(255, "Item name cannot exceed 255 characters"),
    category: QuotationItemCategoryEnum,
    subcategory: z.string().max(100).optional().nullable(),
    technicalSpecs: z.string().min(1, "Technical specifications are required"),
    description: z.string().optional().nullable(),
    uom: z.string().max(50).default("sqft"),
    unitCost: z.coerce.number().nonnegative("Unit cost must be a non-negative number").default(0),
    targetMargin: z.coerce.number().min(0, "Target margin cannot be negative").max(100, "Target margin cannot exceed 100%").default(25),
    imageUrl: imageTypeSchema.optional().nullable(),
    galleryImages: z.array(imageTypeSchema).optional().nullable().default([]),
    approvedBrands: z.array(z.string().max(100)).optional().default([]),
    tags: z.array(z.string().max(50)).optional().default([]),
    isActive: z.boolean().optional().default(true),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for partial / dirty updates of a quotation item master
 */
export const updateQuotationItemSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Quotation Item ID format"),
  }),
  body: z.object({
    sku: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(255).optional(),
    category: QuotationItemCategoryEnum.optional(),
    subcategory: z.string().max(100).optional().nullable(),
    technicalSpecs: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    uom: z.string().max(50).optional(),
    unitCost: z.coerce.number().nonnegative().optional(),
    targetMargin: z.coerce.number().min(0).max(100).optional(),
    imageUrl: imageTypeSchema.optional().nullable(),
    galleryImages: z.array(imageTypeSchema).optional().nullable(),
    approvedBrands: z.array(z.string().max(100)).optional(),
    tags: z.array(z.string().max(50)).optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for querying / filtering paginated quotation items
 */
export const getQuotationItemsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    category: QuotationItemCategoryEnum.optional(),
    subcategory: z.string().optional(),
    uom: z.string().optional(),
    brand: z.string().optional(),
    tag: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
    minCost: z.coerce.number().nonnegative().optional(),
    maxCost: z.coerce.number().nonnegative().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "name", "sku", "unitCost", "targetMargin", "category"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

/**
 * Validator schema for bulk creating quotation items (Catalog Import)
 */
export const bulkCreateQuotationItemsSchema = z.object({
  body: z.object({
    items: z.array(
      z.object({
        sku: z.string().min(1, "SKU is required").max(100),
        name: z.string().min(1, "Item name is required").max(255),
        category: QuotationItemCategoryEnum,
        subcategory: z.string().max(100).optional().nullable(),
        technicalSpecs: z.string().min(1, "Technical specs required"),
        description: z.string().optional().nullable(),
        uom: z.string().max(50).default("sqft"),
        unitCost: z.coerce.number().nonnegative().default(0),
        targetMargin: z.coerce.number().min(0).max(100).default(25),
        approvedBrands: z.array(z.string().max(100)).optional().default([]),
        tags: z.array(z.string().max(50)).optional().default([]),
        isActive: z.boolean().optional().default(true),
        additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
      })
    ).min(1, "At least one item is required for bulk creation").max(100, "Maximum 100 items per bulk upload"),
  }),
});

export type CreateQuotationItemInput = z.infer<typeof createQuotationItemSchema>["body"];
export type UpdateQuotationItemInput = z.infer<typeof updateQuotationItemSchema>["body"];
export type GetQuotationItemsQueryInput = z.infer<typeof getQuotationItemsQuerySchema>["query"];
export type BulkCreateQuotationItemsInput = z.infer<typeof bulkCreateQuotationItemsSchema>["body"];
