import { z } from "zod";
import {
  ProductType,
  ProductStatus,
  ProductOwnershipType,
  PropertyType,
  ListingIntent,
  PropertyVerificationStatus,
} from "../../../types/types.js";

// =============================================================================
// ENUM VALIDATORS (Strict Rule 22: z.nativeEnum from types.ts)
// =============================================================================

export const ProductTypeEnum = z.nativeEnum(ProductType);
export const ProductStatusEnum = z.nativeEnum(ProductStatus);
export const ProductOwnershipTypeEnum = z.nativeEnum(ProductOwnershipType);
export const PropertyTypeEnum = z.nativeEnum(PropertyType);
export const ListingIntentEnum = z.nativeEnum(ListingIntent);
export const PropertyVerificationStatusEnum = z.nativeEnum(
  PropertyVerificationStatus,
);

// =============================================================================
// STRUCTURED IMAGE TYPE & ADDITIONAL INFO SCHEMAS
// =============================================================================

export const imageTypeSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1, "Image URL is required"),
  bytes: z.number().optional(),
  format: z.string().optional(),
  provider: z.string().optional(),
});

export const additionalInformationSchema = z
  .record(z.string(), z.any())
  .optional()
  .nullable();

// =============================================================================
// 1-to-1 TYPE SPECIFIC DETAILS SCHEMAS
// =============================================================================

/**
 * 1. Digital Asset Details Schema
 */
export const digitalProductDetailsSchema = z.object({
  fileUrl: z.string().min(1, "File URL / download asset path is required"),
  fileFormat: z
    .string()
    .min(1, "File format is required (e.g. PDF, RVT, DWG, ZIP)"),
  fileSize: z.string().optional().nullable(),
  previewImages: z.any().optional().nullable(),
  authorName: z.string().optional().nullable(),
  version: z.string().optional().default("1.0.0"),
  compatibleSoftware: z.string().optional().nullable(),
  licenseType: z.string().optional().default("Standard Commercial"),
  downloadLinkExpiryHours: z.number().int().min(1).optional().default(48),
  maxDownloads: z.number().int().min(1).optional().default(5),
  additionalInformation: additionalInformationSchema,
});

export const updateDigitalProductDetailsSchema =
  digitalProductDetailsSchema.partial();

/**
 * 2. Home Decor Details Schema
 */
export const homeDecorProductDetailsSchema = z.object({
  brandName: z.string().optional().nullable(),
  material: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  roomType: z.string().optional().nullable(),
  style: z.string().optional().nullable(),
  assemblyRequired: z.boolean().optional().default(false),
  careInstructions: z.string().optional().nullable(),
  sampleAvailable: z.boolean().optional().default(false),
  samplePrice: z.number().min(0).optional().nullable().default(0),
  leadTimeDays: z.number().int().min(0).optional().default(5),
  additionalInformation: additionalInformationSchema,
});

export const updateHomeDecorProductDetailsSchema =
  homeDecorProductDetailsSchema.partial();

/**
 * 3. Property Listing Details Schema
 */
export const propertyListingDetailsSchema = z.object({
  propertyType: PropertyTypeEnum.optional().default(PropertyType.APARTMENT),
  intent: ListingIntentEnum.optional().default(ListingIntent.SALE),
  verificationStatus: PropertyVerificationStatusEnum.optional().default(
    PropertyVerificationStatus.DRAFT,
  ),
  bhk: z
    .string()
    .min(1, "BHK specification is required (e.g. 3 BHK, 4 BHK Villa)"),
  bedrooms: z.number().int().min(0, "Bedrooms count cannot be negative"),
  bathrooms: z.number().int().min(0, "Bathrooms count cannot be negative"),
  balconies: z.number().int().min(0).optional().default(0),
  carpetAreaSqft: z.number().int().min(1, "Carpet area in sq.ft is required"),
  superBuiltUpSqft: z.number().int().min(1).optional().nullable(),
  floorNumber: z.number().int().optional().nullable(),
  totalFloors: z.number().int().optional().nullable(),
  furnishingStatus: z.string().optional().default("Unfurnished"),
  coveredParkingSlots: z.number().int().min(0).optional().default(0),
  availableFrom: z.coerce.date().optional().nullable(),
  reraRegistration: z.string().optional().nullable(),
  maintenanceMonthly: z.number().min(0).optional().default(0),
  isNegotiable: z.boolean().optional().default(true),
  contactUnlockFee: z.number().min(0).optional().default(500),
  contactUnlockDurationDays: z.number().int().min(1).optional().default(30),
  ownerName: z.string().min(1, "Owner / Builder name is required"),
  ownerPhone: z.string().min(1, "Owner / Contact phone is required"),
  ownerEmail: z.string().email("Invalid email format").optional().nullable(),
  addressLine: z.string().optional().nullable(),
  locality: z.string().min(1, "Locality is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pinCode: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  amenities: z.array(z.string()).optional().default([]),
  additionalInformation: additionalInformationSchema,
});

export const updatePropertyListingDetailsSchema =
  propertyListingDetailsSchema.partial();

/**
 * 4. Wholesale Material Details Schema
 */
export const materialProductDetailsSchema = z.object({
  brandName: z.string().optional().nullable(),
  materialType: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  dimensions: z.string().optional().nullable(),
  thickness: z.string().optional().nullable(),
  application: z.string().optional().nullable(),
  coveragePerUnit: z.string().optional().nullable(),
  warrantyYears: z.number().int().min(0).optional().default(0),
  technicalDocUrl: z.string().optional().nullable(),
  leadTimeDays: z.number().int().min(0).optional().default(7),
  additionalInformation: additionalInformationSchema,
});

export const updateMaterialProductDetailsSchema =
  materialProductDetailsSchema.partial();

// =============================================================================
// MAIN PRODUCT SCHEMAS (CREATE, UPDATE, QUERY, PARAMS)
// =============================================================================

/**
 * Unified Create Product Schema
 */
export const createProductSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Product name must have at least 2 characters"),
    slug: z.string().trim().optional(),
    sku: z.string().trim().optional().nullable(),
    type: ProductTypeEnum,
    description: z.string().trim().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),

    // Media
    coverImageUrl: z.any().optional().nullable(),
    images: z.any().optional().nullable(),

    // Ownership & Sourcing
    ownershipType: ProductOwnershipTypeEnum.optional().default(
      ProductOwnershipType.SELF_OWNED,
    ),
    vendorId: z.string().uuid("Invalid Vendor ID format").optional().nullable(),

    // Universal Pricing & Currency
    currency: z.string().optional().default("INR"),
    mrp: z.number().min(0, "MRP cannot be negative").default(0),
    sellingPrice: z
      .number()
      .min(0, "Selling price cannot be negative")
      .default(0),
    costPrice: z.number().min(0).optional().nullable().default(0),
    taxRate: z.number().min(0).max(100).optional().default(18.0),
    isTaxInclusive: z.boolean().optional().default(false),
    discountPercent: z.number().min(0).max(100).optional().default(0),

    // Stock & Flexible String Unit (e.g. 'piece', 'sq.ft', 'kg', 'box', 'ton')
    unit: z.string().trim().optional().nullable().default("piece"),
    inStock: z.boolean().optional().default(true),
    stockQuantity: z.number().int().min(0).optional().default(0),
    minOrderQuantity: z.number().int().min(1).optional().default(1),
    lowStockAlert: z.number().int().min(0).optional().default(5),

    // Publishing Status
    status: ProductStatusEnum.optional().default(ProductStatus.DRAFT),
    isFeatured: z.boolean().optional().default(false),
    isPublished: z.boolean().optional().default(false),

    // Custom Dynamic Fields
    additionalInformation: additionalInformationSchema,

    // Nested 1-to-1 Type Specific Details (Provided based on type)
    digitalDetails: digitalProductDetailsSchema.optional().nullable(),
    homeDecorDetails: homeDecorProductDetailsSchema.optional().nullable(),
    propertyDetails: propertyListingDetailsSchema.optional().nullable(),
    materialDetails: materialProductDetailsSchema.optional().nullable(),
  }),
});

/**
 * Unified Update Product Schema (Partial/Dirty updates)
 */
export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
  body: z.object({
    name: z.string().trim().min(2).optional(),
    slug: z.string().trim().optional(),
    sku: z.string().trim().optional().nullable(),
    description: z.string().trim().optional().nullable(),
    tags: z.array(z.string()).optional(),

    // Media
    coverImageUrl: z.any().optional().nullable(),
    images: z.any().optional().nullable(),

    // Ownership & Sourcing
    ownershipType: ProductOwnershipTypeEnum.optional(),
    vendorId: z.string().uuid("Invalid Vendor ID format").optional().nullable(),

    // Pricing
    currency: z.string().optional(),
    mrp: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional().nullable(),
    taxRate: z.number().min(0).max(100).optional(),
    isTaxInclusive: z.boolean().optional(),
    discountPercent: z.number().min(0).max(100).optional(),

    // Stock & Measurement Unit
    unit: z.string().trim().optional().nullable(),
    inStock: z.boolean().optional(),
    stockQuantity: z.number().int().min(0).optional(),
    minOrderQuantity: z.number().int().min(1).optional(),
    lowStockAlert: z.number().int().min(0).optional(),

    // Status
    status: ProductStatusEnum.optional(),
    isFeatured: z.boolean().optional(),
    isPublished: z.boolean().optional(),

    // Custom Fields
    additionalInformation: additionalInformationSchema,

    // Nested 1-to-1 Type Specific Updates
    digitalDetails: updateDigitalProductDetailsSchema.optional().nullable(),
    homeDecorDetails: updateHomeDecorProductDetailsSchema.optional().nullable(),
    propertyDetails: updatePropertyListingDetailsSchema.optional().nullable(),
    materialDetails: updateMaterialProductDetailsSchema.optional().nullable(),
  }),
});

/**
 * Query Filter Schema for Products Catalog
 */
export const getProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().optional(),
    type: ProductTypeEnum.optional(),
    status: ProductStatusEnum.optional(),
    ownershipType: ProductOwnershipTypeEnum.optional(),
    vendorId: z.string().uuid("Invalid vendor ID format").optional(),
    isFeatured: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    isPublished: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    city: z.string().trim().optional(),
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
    sortBy: z
      .enum([
        "createdAt",
        "name",
        "sellingPrice",
        "rating",
        "totalSales",
        "stockQuantity",
      ])
      .optional()
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

/**
 * Param Schema by ID
 */
export const productIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
});

/**
 * Param Schema by Slug
 */
export const productSlugParamSchema = z.object({
  params: z.object({
    slug: z.string().min(1, "Product slug is required"),
  }),
});

/**
 * Update Product Status Schema
 */
export const updateProductStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid product ID format"),
  }),
  body: z.object({
    status: ProductStatusEnum,
  }),
});
