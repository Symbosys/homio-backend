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

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const createPropertySchema = z.object({
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional().nullable(),
    title: z.string().trim().min(1, "Property title is required"),
    slug: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional().default("APARTMENT"),
    intent: listingIntentEnum.optional().default("SALE"),
    verificationStatus: propertyVerificationStatusEnum.optional().default("DRAFT"),

    // Specifications
    bhk: z.string().trim().min(1, "BHK configuration is required (e.g. 3 BHK)"),
    bedrooms: z.number().int().min(0, "Bedrooms count is required"),
    bathrooms: z.number().int().min(0, "Bathrooms count is required"),
    balconies: z.number().int().min(0).optional().default(0),
    carpetAreaSqft: z.number().int().positive("Carpet area in sqft is required"),
    superBuiltUpSqft: z.number().int().positive().optional().nullable(),
    floorNumber: z.number().int().optional().nullable(),
    totalFloors: z.number().int().optional().nullable(),
    furnishingStatus: z.string().trim().optional().default("Unfurnished"),
    coveredParkingSlots: z.number().int().min(0).optional().default(0),
    availableFrom: z.coerce.date().optional().nullable(),

    // Location
    addressLine: z.string().trim().optional().nullable(),
    locality: z.string().trim().min(1, "Locality is required"),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pinCode: z.string().trim().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),

    // Pricing
    price: z.number().min(0, "Price is required"),
    maintenanceMonthly: z.number().min(0).optional().default(0),
    isNegotiable: z.boolean().optional().default(true),

    // Contact Unlock Monetization
    contactUnlockFee: z.number().min(0).optional().default(500),
    contactUnlockDurationDays: z.number().int().positive().optional().default(30),

    // Owner Contact Details
    ownerName: z.string().trim().min(1, "Owner name is required"),
    ownerPhone: z.string().trim().min(1, "Owner phone number is required"),
    ownerEmail: z.string().trim().email("Invalid owner email").optional().nullable(),

    // Amenities & Media
    amenities: z.array(z.string().trim()).optional().default([]),
    description: z.string().trim().nullable().optional(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    images: z.array(z.union([z.string().trim(), imageTypeSchema])).optional().default([]),

    status: productStatusEnum.optional().default("DRAFT"),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property listing ID format"),
  }),
  body: z.object({
    categoryId: z.string().uuid("Invalid category ID format").optional().nullable(),
    title: z.string().trim().min(1).optional(),
    slug: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional(),
    intent: listingIntentEnum.optional(),
    verificationStatus: propertyVerificationStatusEnum.optional(),

    bhk: z.string().trim().min(1).optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional(),
    balconies: z.number().int().min(0).optional(),
    carpetAreaSqft: z.number().int().positive().optional(),
    superBuiltUpSqft: z.number().int().positive().optional().nullable(),
    floorNumber: z.number().int().optional().nullable(),
    totalFloors: z.number().int().optional().nullable(),
    furnishingStatus: z.string().trim().optional(),
    coveredParkingSlots: z.number().int().min(0).optional(),
    availableFrom: z.coerce.date().optional().nullable(),

    addressLine: z.string().trim().optional().nullable(),
    locality: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    state: z.string().trim().min(1).optional(),
    pinCode: z.string().trim().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),

    price: z.number().min(0).optional(),
    maintenanceMonthly: z.number().min(0).optional(),
    isNegotiable: z.boolean().optional(),

    contactUnlockFee: z.number().min(0).optional(),
    contactUnlockDurationDays: z.number().int().positive().optional(),

    ownerName: z.string().trim().min(1).optional(),
    ownerPhone: z.string().trim().min(1).optional(),
    ownerEmail: z.string().trim().email("Invalid owner email").optional().nullable(),

    amenities: z.array(z.string().trim()).optional(),
    description: z.string().trim().optional().nullable(),
    coverImageUrl: z.union([z.string().trim(), imageTypeSchema]).nullable().optional(),
    images: z.array(z.union([z.string().trim(), imageTypeSchema])).optional(),

    status: productStatusEnum.optional(),
    isFeatured: z.boolean().optional(),
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
    city: z.string().trim().optional(),
    locality: z.string().trim().optional(),
    propertyType: propertyTypeEnum.optional(),
    intent: listingIntentEnum.optional(),
    bhk: z.string().trim().optional(),
    minPrice: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined)),
    maxPrice: z
      .string()
      .optional()
      .transform((val) => (val ? parseFloat(val) : undefined)),
    verificationStatus: propertyVerificationStatusEnum.optional(),
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

export const propertyIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid property listing ID format"),
  }),
});
