import { z } from "zod";
import { productStatusEnum } from "./digital-product.validator.js";

export const productOwnershipTypeEnum = z.enum(["SELF_OWNED", "VENDOR_OWNED"]);

export const affiliatePartnerEnum = z.enum([
  "AMAZON",
  "PEPPERFRY",
  "URBAN_LADDER",
  "WEST_ELM",
  "IKEA",
  "CUSTOM",
]);

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

/**
 * Validator schema for creating a Home Decor vendor offering (supplier mapping)
 */
export const createHomeDecorVendorOfferingBodySchema = z.object({
  vendorId: z.string().uuid("Invalid vendor ID format"),
  commissionRate: z.number().min(0, "Commission rate must be >= 0").max(100, "Commission rate must be <= 100").optional(),
  supplyPrice: z.number().min(0, "Supply price cannot be negative").optional().nullable(),
  sellingPrice: z.number().min(0, "Selling price cannot be negative").optional().nullable(),
  vendorSku: z.string().trim().optional().nullable(),
  stockCount: z.number().int().min(0).optional().default(0),
  inStock: z.boolean().optional().default(true),
  minOrderQuantity: z.number().int().positive().optional().default(1),
  leadTimeDays: z.number().int().min(0).optional().default(3),
  isPrimary: z.boolean().optional().default(false),
  additionalInformation: z.record(z.string(), z.any()).nullable().optional(),
});

export const createHomeDecorVendorOfferingSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
  }),
  body: createHomeDecorVendorOfferingBodySchema,
});

/**
 * Validator schema for updating a Home Decor vendor offering
 */
export const updateHomeDecorVendorOfferingSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
    vendorOfferingId: z.string().uuid("Invalid vendor offering ID format"),
  }),
  body: z.object({
    commissionRate: z.number().min(0).max(100).optional(),
    supplyPrice: z.number().min(0).optional().nullable(),
    sellingPrice: z.number().min(0).optional().nullable(),
    vendorSku: z.string().trim().optional().nullable(),
    stockCount: z.number().int().min(0).optional(),
    inStock: z.boolean().optional(),
    minOrderQuantity: z.number().int().positive().optional(),
    leadTimeDays: z.number().int().min(0).optional(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).nullable().optional(),
  }),
});

/**
 * Route parameter validator for vendor offering routes
 */
export const homeDecorVendorParamSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
    vendorOfferingId: z.string().uuid("Invalid vendor offering ID format").optional(),
  }),
});

export const createHomeDecorSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format"),
    ownershipType: productOwnershipTypeEnum.optional().default("SELF_OWNED"),
    vendorOfferings: z.array(createHomeDecorVendorOfferingBodySchema).optional().default([]),

    name: z.string().trim().min(1, "Product name is required"),
    sku: z.string().trim().min(1, "SKU is required"),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional().default([]),

    // Specifications
    material: z.string().trim().nullable().optional(),
    color: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    roomType: z.string().trim().nullable().optional(),

    // Media
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    galleryUrls: z.array(z.union([z.string().trim(), imageTypeSchema])).optional().default([]),

    // Pricing & Inventory
    mrp: z.number().min(0).optional().default(0),
    sellingPrice: z.number().min(0).optional().default(0),
    taxRate: z.number().min(0).max(100).optional().default(18.0),
    inStock: z.boolean().optional().default(true),
    stockCount: z.number().int().min(0).optional().default(0),
    minOrderQuantity: z.number().int().positive().optional().default(1),

    // Sample
    sampleAvailable: z.boolean().optional().default(false),
    samplePrice: z.number().min(0).optional().default(0),

    // Affiliate
    isAffiliateEnabled: z.boolean().optional().default(false),
    affiliatePartner: affiliatePartnerEnum.nullable().optional(),
    affiliateUrl: z.string().trim().url().nullable().optional(),
    commissionRate: z.number().min(0).max(100).optional().default(0),

    // Status
    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updateHomeDecorSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional(),
    ownershipType: productOwnershipTypeEnum.optional(),

    name: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional(),

    material: z.string().trim().nullable().optional(),
    color: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    roomType: z.string().trim().nullable().optional(),

    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    galleryUrls: z.array(z.union([z.string().trim(), imageTypeSchema])).optional(),

    mrp: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    inStock: z.boolean().optional(),
    stockCount: z.number().int().min(0).optional(),
    minOrderQuantity: z.number().int().positive().optional(),

    sampleAvailable: z.boolean().optional(),
    samplePrice: z.number().min(0).optional(),

    isAffiliateEnabled: z.boolean().optional(),
    affiliatePartner: affiliatePartnerEnum.nullable().optional(),
    affiliateUrl: z.string().trim().url().nullable().optional(),
    commissionRate: z.number().min(0).max(100).optional(),

    status: productStatusEnum.optional(),
    isFeatured: z.boolean().optional(),
  }),
});

export const getHomeDecorQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    ownershipType: productOwnershipTypeEnum.optional(),
    roomType: z.string().trim().optional(),
    status: productStatusEnum.optional(),
    inStock: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().trim().optional(),
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

export const homeDecorIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
});

