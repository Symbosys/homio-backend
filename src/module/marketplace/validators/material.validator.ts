import { z } from "zod";
import { productStatusEnum } from "./digital-product.validator.js";
import { productOwnershipTypeEnum } from "./home-decor.validator.js";

export const materialUnitEnum = z.enum([
  "PIECE",
  "SET",
  "PAIR",
  "GRAM",
  "KG",
  "TON",
  "MM",
  "CM",
  "METER",
  "KM",
  "SQ_FT",
  "SQ_M",
  "ML",
  "LITRE",
  "SHEET",
  "BOX",
  "PACK",
  "ROLL",
  "DRUM",
  "BAG",
  "BUNDLE",
]);

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const createMaterialSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format"),
    ownershipType: productOwnershipTypeEnum.optional().default("SELF_OWNED"),
    vendorId: z.string().uuid("Invalid vendor ID format").nullable().optional(),
    ownerCommissionRate: z.number().min(0).max(100).nullable().optional(),

    name: z.string().trim().min(1, "Material product name is required"),
    sku: z.string().trim().min(1, "SKU is required"),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional().default([]),

    // Specifications
    materialType: z.string().trim().nullable().optional(),
    grade: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    thickness: z.string().trim().nullable().optional(),
    application: z.string().trim().nullable().optional(),

    // Media
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    images: z.array(z.union([z.string().trim(), imageTypeSchema])).optional().default([]),

    // Pricing & Inventory
    unitOfMeasure: materialUnitEnum.optional().default("PIECE"),
    wholesalePrice: z.number().min(0).optional().default(0),
    retailPrice: z.number().min(0).optional().default(0),
    taxRate: z.number().min(0).max(100).optional().default(18.0),
    minOrderQuantity: z.number().int().positive().optional().default(1),
    stockAvailableUnits: z.number().int().min(0).optional().default(0),

    // Status
    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updateMaterialSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid material product ID format"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional(),
    ownershipType: productOwnershipTypeEnum.optional(),
    vendorId: z.string().uuid("Invalid vendor ID format").nullable().optional(),
    ownerCommissionRate: z.number().min(0).max(100).nullable().optional(),

    name: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim()).optional(),

    materialType: z.string().trim().nullable().optional(),
    grade: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    thickness: z.string().trim().nullable().optional(),
    application: z.string().trim().nullable().optional(),

    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    images: z.array(z.union([z.string().trim(), imageTypeSchema])).optional(),

    unitOfMeasure: materialUnitEnum.optional(),
    wholesalePrice: z.number().min(0).optional(),
    retailPrice: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    minOrderQuantity: z.number().int().positive().optional(),
    stockAvailableUnits: z.number().int().min(0).optional(),

    status: productStatusEnum.optional(),
    isFeatured: z.boolean().optional(),
  }),
});

export const getMaterialsQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    ownershipType: productOwnershipTypeEnum.optional(),
    unitOfMeasure: materialUnitEnum.optional(),
    materialType: z.string().trim().optional(),
    status: productStatusEnum.optional(),
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

export const materialIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid material product ID format"),
  }),
});
