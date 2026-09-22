import { z } from "zod";
import { productStatusEnum } from "./digital-product.validator.js";

export const propertyTypeEnum = z.enum([
  "APARTMENT",
  "PENTHOUSE",
  "BUILDER_FLOOR",
  "VILLA",
  "COMMERCIAL",
]);

export const listingIntentEnum = z.enum(["RENT", "SALE"]);

export const propertyVerificationStatusEnum = z.enum([
  "DRAFT",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
]);

const stringToNumber = (defaultVal = 0) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().optional().default(defaultVal));

const stringToNullableNumber = z.preprocess((val) => {
  if (val === undefined || val === null || val === "" || val === "null")
    return null;
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
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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

export const createPropertySchema = z.object({
  body: z.object({
    categoryId: z
      .string()
      .uuid("Invalid category ID format")
      .optional()
      .nullable(),
    title: z.string().trim().min(1, "Property title is required"),
    slug: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional().default("APARTMENT"),
    intent: listingIntentEnum.optional().default("SALE"),
    verificationStatus: propertyVerificationStatusEnum
      .optional()
      .default("DRAFT"),

    // Specifications
    bhk: z.string().trim().min(1, "BHK configuration is required (e.g. 3 BHK)"),
    bedrooms: stringToNumber(1),
    bathrooms: stringToNumber(1),
    balconies: stringToNumber(0),
    carpetAreaSqft: stringToNumber(1000),
    superBuiltUpSqft: stringToNullableNumber,
    floorNumber: stringToNullableNumber,
    totalFloors: stringToNullableNumber,
    furnishingStatus: z.string().trim().optional().default("Unfurnished"),
    coveredParkingSlots: stringToNumber(0),
    availableFrom: z.preprocess((val) => {
      if (val === undefined || val === null || val === "" || val === "null")
        return null;
      return new Date(val as string);
    }, z.date().nullable().optional()),

    // Location
    addressLine: z.string().trim().optional().nullable(),
    locality: z.string().trim().min(1, "Locality is required"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pinCode: z.string().trim().optional().nullable(),
    latitude: stringToNullableNumber,
    longitude: stringToNullableNumber,

    // Pricing
    price: stringToNumber(0),
    maintenanceMonthly: stringToNumber(0),
    isNegotiable: stringToBoolean(true),

    // Contact Unlock Monetization
    contactUnlockFee: stringToNumber(500),
    contactUnlockDurationDays: stringToNumber(30),
    totalContactUnlocks: stringToNumber(0),

    // Owner Contact Details
    ownerName: z.string().trim().min(1, "Owner name is required"),
    ownerPhone: z.string().trim().min(1, "Owner phone number is required"),
    ownerEmail: z
      .string()
      .trim()
      .email("Invalid owner email")
      .optional()
      .nullable(),

    // Amenities & Media
    amenities: stringToArray,
    description: z.string().trim().nullable().optional(),
    coverImageUrl: z
      .union([z.string().trim(), imageTypeSchema, z.any()])
      .nullable()
      .optional(),
    images: z.any().optional().default([]),

    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: stringToBoolean(false),
  }),
});

export const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property listing ID format"),
  }),
  body: z.object({
    categoryId: z
      .string()
      .uuid("Invalid category ID format")
      .optional()
      .nullable(),
    title: z.string().trim().min(1).optional(),
    slug: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional(),
    intent: listingIntentEnum.optional(),
    verificationStatus: propertyVerificationStatusEnum.optional(),

    bhk: z.string().trim().min(1).optional(),
    bedrooms: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().min(0).optional(),
    ),
    bathrooms: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().min(0).optional(),
    ),
    balconies: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().min(0).optional(),
    ),
    carpetAreaSqft: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().positive().optional(),
    ),
    superBuiltUpSqft: stringToNullableNumber,
    floorNumber: stringToNullableNumber,
    totalFloors: stringToNullableNumber,
    furnishingStatus: z.string().trim().optional(),
    coveredParkingSlots: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().min(0).optional(),
    ),
    availableFrom: z.preprocess((val) => {
      if (val === undefined || val === null || val === "" || val === "null")
        return null;
      return new Date(val as string);
    }, z.date().nullable().optional()),

    addressLine: z.string().trim().optional().nullable(),
    locality: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    pinCode: z.string().trim().optional().nullable(),
    latitude: stringToNullableNumber,
    longitude: stringToNullableNumber,

    price: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().min(0).optional(),
    ),
    maintenanceMonthly: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().min(0).optional(),
    ),
    isNegotiable: z.preprocess(
      (val) =>
        val === "true" || val === true
          ? true
          : val === "false" || val === false
            ? false
            : undefined,
      z.boolean().optional(),
    ),

    contactUnlockFee: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().min(0).optional(),
    ),
    contactUnlockDurationDays: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().positive().optional(),
    ),
    totalContactUnlocks: z.preprocess(
      (val) => (val !== undefined && val !== "" ? Number(val) : undefined),
      z.number().int().min(0).optional(),
    ),

    ownerName: z.string().trim().min(1).optional(),
    ownerPhone: z.string().trim().min(1).optional(),
    ownerEmail: z
      .string()
      .trim()
      .email("Invalid owner email")
      .optional()
      .nullable(),

    amenities: stringToArray.optional(),
    description: z.string().trim().optional().nullable(),
    coverImageUrl: z
      .union([z.string().trim(), imageTypeSchema, z.any()])
      .nullable()
      .optional(),
    images: z.any().optional(),

    status: productStatusEnum.optional(),
    isFeatured: z.preprocess(
      (val) =>
        val === "true" || val === true
          ? true
          : val === "false" || val === false
            ? false
            : undefined,
      z.boolean().optional(),
    ),
  }),
});

export const updatePropertyVerificationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property listing ID format"),
  }),
  body: z.object({
    verificationStatus: propertyVerificationStatusEnum,
  }),
});

export const getPropertiesQuerySchema = z.object({
  query: z.object({
    organizationId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    city: z.string().trim().optional(),
    locality: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional(),
    intent: listingIntentEnum.optional(),
    verificationStatus: propertyVerificationStatusEnum.optional(),
    status: productStatusEnum.optional(),
    isFeatured: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().trim().optional(),
    minPrice: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined)),
    maxPrice: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined)),
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

export const propertyIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property listing ID format"),
  }),
});
