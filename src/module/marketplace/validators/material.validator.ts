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

const stringToNumber = (defaultVal = 0) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().optional().default(defaultVal));

const stringToNullableNumber = z.preprocess((val) => {
  if (val === undefined || val === null || val === "" || val === "null") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}, z.number().nullable().optional());

const stringToBoolean = (defaultVal = true) =>
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

/**
 * Validator schema for creating a Material vendor offering (supplier mapping)
 */
export const createMaterialVendorOfferingBodySchema = z.object({
  vendorId: z.string().uuid("Invalid vendor ID format"),
  commissionRate: z.number().min(0, "Commission rate must be >= 0").max(100, "Commission rate must be <= 100").optional(),
  wholesalePrice: stringToNullableNumber,
  retailPrice: stringToNullableNumber,
  vendorSku: z.string().trim().optional().nullable(),
  stockAvailableUnits: z.number().int().min(0).optional().default(0),
  minOrderQuantity: z.number().int().positive().optional().default(1),
  leadTimeDays: z.number().int().min(0).optional().default(7),
  isPrimary: z.boolean().optional().default(false),
  additionalInformation: z.record(z.string(), z.any()).nullable().optional(),
});

export const createMaterialVendorOfferingSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
  }),
  body: createMaterialVendorOfferingBodySchema,
});

/**
 * Validator schema for updating a Material vendor offering
 */
export const updateMaterialVendorOfferingSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
    vendorOfferingId: z.string().uuid("Invalid vendor offering ID format"),
  }),
  body: z.object({
    commissionRate: z.number().min(0).max(100).optional(),
    wholesalePrice: z.number().min(0).optional().nullable(),
    retailPrice: z.number().min(0).optional().nullable(),
    vendorSku: z.string().trim().optional().nullable(),
    stockAvailableUnits: z.number().int().min(0).optional(),
    minOrderQuantity: z.number().int().positive().optional(),
    leadTimeDays: z.number().int().min(0).optional(),
    isPrimary: z.boolean().optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).nullable().optional(),
  }),
});

/**
 * Route parameter validator for material vendor offering routes
 */
export const materialVendorParamSchema = z.object({
  params: z.object({
    productId: z.string().uuid("Invalid product ID format"),
    vendorOfferingId: z.string().uuid("Invalid vendor offering ID format").optional(),
  }),
});

export const createMaterialSchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format"),
    ownershipType: productOwnershipTypeEnum.optional().default("SELF_OWNED"),
    vendorOfferings: z.array(createMaterialVendorOfferingBodySchema).optional().default([]),

    name: z.string().trim().min(1, "Material product name is required"),
    sku: z.string().trim().min(1, "SKU is required"),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: stringToArray,

    // Specifications
    materialType: z.string().trim().nullable().optional(),
    grade: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    thickness: z.string().trim().nullable().optional(),
    application: z.string().trim().nullable().optional(),

    // Media
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema, z.any()]).nullable().optional(),
    images: z.any().optional().default([]),

    // Pricing & Inventory
    unitOfMeasure: materialUnitEnum.optional().default("PIECE"),
    wholesalePrice: stringToNumber(0),
    retailPrice: stringToNumber(0),
    taxRate: stringToNumber(18.0),
    minOrderQuantity: stringToNumber(1),
    stockAvailableUnits: stringToNumber(0),

    // Status & Metrics
    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: stringToBoolean(false),
    rating: stringToNumber(0.0),
    ordersCount: stringToNumber(0),
  }),
});

export const updateMaterialSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid material product ID format"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional(),
    ownershipType: productOwnershipTypeEnum.optional(),

    name: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1).optional(),
    brandName: z.string().trim().nullable().optional(),
    description: z.string().trim().nullable().optional(),
    tags: stringToArray.optional(),

    materialType: z.string().trim().nullable().optional(),
    grade: z.string().trim().nullable().optional(),
    dimensions: z.string().trim().nullable().optional(),
    thickness: z.string().trim().nullable().optional(),
    application: z.string().trim().nullable().optional(),

    coverImageUrl: z.union([z.string().trim(), imageTypeSchema, z.any()]).nullable().optional(),
    images: z.any().optional(),

    unitOfMeasure: materialUnitEnum.optional(),
    wholesalePrice: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).optional()),
    retailPrice: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).optional()),
    taxRate: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).max(100).optional()),
    minOrderQuantity: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().positive().optional()),
    stockAvailableUnits: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().min(0).optional()),

    status: productStatusEnum.optional(),
    isFeatured: z.preprocess((val) => (val === "true" || val === true ? true : val === "false" || val === false ? false : undefined), z.boolean().optional()),
    rating: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().min(0).max(5).optional()),
    ordersCount: z.preprocess((val) => (val !== undefined && val !== "" ? Number(val) : undefined), z.number().int().min(0).optional()),
  }),
});

export const getMaterialsQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    vendorId: z.string().uuid().optional(),
    materialType: z.string().trim().optional(),
    unitOfMeasure: materialUnitEnum.optional(),
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

export const materialIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid material product ID format"),
  }),
});
