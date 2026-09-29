import { z } from "zod";
import {
  QuotationStatus,
  QuotationDiscountType,
  QuotationRoomAreaType,
  QuotationItemCategory,
  PdfPageImagePosition,
} from "../../../types/types.js";

/**
 * ImageType schema for multi-cloud structured media objects
 */
const ImageTypeSchema = z.object({
  id: z.string().min(1, "Image ID is required"),
  url: z.string().url("Invalid image URL"),
  bytes: z.number().nonnegative("Bytes must be a non-negative number"),
  format: z.string().min(1, "Format is required"),
  provider: z.enum(["CLOUDINARY", "S3", "AZURE", "LOCAL"]).default("CLOUDINARY"),
});

/**
 * Case-insensitive & camelCase normalizer for Room Area Types
 */
const RoomAreaTypeMapping: Record<string, QuotationRoomAreaType> = {
  livingRoom: QuotationRoomAreaType.LIVING_ROOM,
  living_room: QuotationRoomAreaType.LIVING_ROOM,
  masterBedroom: QuotationRoomAreaType.MASTER_BEDROOM,
  master_bedroom: QuotationRoomAreaType.MASTER_BEDROOM,
  guestBedroom: QuotationRoomAreaType.GUEST_BEDROOM,
  guest_bedroom: QuotationRoomAreaType.GUEST_BEDROOM,
  kidsBedroom: QuotationRoomAreaType.KIDS_BEDROOM,
  kids_bedroom: QuotationRoomAreaType.KIDS_BEDROOM,
  kitchen: QuotationRoomAreaType.KITCHEN,
  diningArea: QuotationRoomAreaType.DINING_AREA,
  dining_area: QuotationRoomAreaType.DINING_AREA,
  balcony: QuotationRoomAreaType.BALCONY,
  bathroom: QuotationRoomAreaType.BATHROOM,
  poojaRoom: QuotationRoomAreaType.POOJA_ROOM,
  pooja_room: QuotationRoomAreaType.POOJA_ROOM,
  foyer: QuotationRoomAreaType.FOYER,
  utility: QuotationRoomAreaType.UTILITY,
  homeOffice: QuotationRoomAreaType.HOME_OFFICE,
  home_office: QuotationRoomAreaType.HOME_OFFICE,
  entertainment: QuotationRoomAreaType.ENTERTAINMENT,
  other: QuotationRoomAreaType.OTHER,
};

const QuotationRoomAreaTypeSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (RoomAreaTypeMapping[trimmed]) {
      return RoomAreaTypeMapping[trimmed];
    }
    const normalized = trimmed
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toUpperCase()
      .replace(/[-\s]+/g, "_");

    if (Object.values(QuotationRoomAreaType).includes(normalized as any)) {
      return normalized;
    }
  }
  return val;
}, z.nativeEnum(QuotationRoomAreaType).default(QuotationRoomAreaType.OTHER));

/**
 * Case-insensitive normalizer for Item Categories
 */
const QuotationItemCategorySchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    const normalized = trimmed
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toUpperCase()
      .replace(/[-\s]+/g, "_");

    if (Object.values(QuotationItemCategory).includes(normalized as any)) {
      return normalized;
    }
  }
  return val;
}, z.nativeEnum(QuotationItemCategory));

/**
 * Nested line item schema for quotation room
 */
export const CreateQuotationItemInputSchema = z.object({
  itemMasterId: z.string().uuid("Invalid itemMasterId format").optional().nullable(),
  itemCode: z.string().min(1, "Item code is required").max(100),
  name: z.string().min(1, "Item name is required").max(255),
  category: QuotationItemCategorySchema,
  materialSpecs: z.string().min(1, "Material specifications are required"),
  uom: z.string().max(50).default("sqft"),
  length: z.coerce.number().positive().optional().nullable(),
  height: z.coerce.number().positive().optional().nullable(),
  depth: z.coerce.number().positive().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero").default(1),
  rate: z.coerce.number().nonnegative("Rate must be non-negative").default(0),
  marginPercent: z.coerce.number().default(25),
  amount: z.coerce.number().nonnegative("Amount must be non-negative").default(0),
  sortOrder: z.coerce.number().int().default(0),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Nested spatial room schema for quotation
 */
export const CreateQuotationRoomInputSchema = z.object({
  roomName: z.string().min(1, "Room name is required").max(150),
  areaType: QuotationRoomAreaTypeSchema,
  carpetAreaSqft: z.coerce.number().nonnegative().default(0).optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(CreateQuotationItemInputSchema).default([]),
});

/**
 * Nested payment schedule milestone schema
 */
export const CreateQuotationPaymentMilestoneInputSchema = z.object({
  stageName: z.string().min(1, "Stage name is required").max(150),
  percentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100"),
  amount: z.coerce.number().nonnegative("Milestone amount must be non-negative"),
  triggerEvent: z.string().min(1, "Trigger event description is required").max(255),
  expectedDate: z.string().datetime().optional().nullable(),
  isCompleted: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Nested presentation PDF page asset schema
 */
export const CreateQuotationPdfPageInputSchema = z.object({
  title: z.string().min(1, "Page title is required").max(150),
  position: z.nativeEnum(PdfPageImagePosition, {
    message: "Position must be FRONT or BACK",
  }),
  sortOrder: z.number().int().default(0),
  pageLabel: z.string().max(50).optional().nullable(),
  image: ImageTypeSchema,
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

const QuotationStatusMapping: Record<string, QuotationStatus> = {
  draft: QuotationStatus.DRAFT,
  internalReview: QuotationStatus.INTERNAL_REVIEW,
  internal_review: QuotationStatus.INTERNAL_REVIEW,
  readyToSend: QuotationStatus.READY_TO_SEND,
  ready_to_send: QuotationStatus.READY_TO_SEND,
  sent: QuotationStatus.SENT,
  submitted: QuotationStatus.SENT,
  viewed: QuotationStatus.VIEWED,
  underReview: QuotationStatus.UNDER_REVIEW,
  under_review: QuotationStatus.UNDER_REVIEW,
  accepted: QuotationStatus.ACCEPTED,
  booked: QuotationStatus.BOOKED,
  rejected: QuotationStatus.REJECTED,
  expired: QuotationStatus.EXPIRED,
  revised: QuotationStatus.REVISED,
  cancelled: QuotationStatus.CANCELLED,
  archived: QuotationStatus.ARCHIVED,
};

export const QuotationStatusSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    if (QuotationStatusMapping[val]) {
      return QuotationStatusMapping[val];
    }
    const upper = val.toUpperCase().replace(/[-\s]+/g, "_");
    if (Object.values(QuotationStatus).includes(upper as any)) {
      return upper;
    }
  }
  return val;
}, z.nativeEnum(QuotationStatus));

/**
 * Primary Create Quotation validation schema
 */
export const CreateQuotationSchema = z.object({
  leadId: z.string().uuid("Valid leadId UUID is required"),
  customerId: z.string().uuid("Invalid customerId UUID format").optional().nullable(),
  quoteNumber: z.string().max(100).optional(),
  version: z.string().max(20).default("v1.0"),
  title: z.string().min(1, "Quotation proposal title is required").max(255),
  quotationType: z.string().max(100).default("residentialInterior"),
  status: QuotationStatusSchema.default(QuotationStatus.DRAFT),

  salesOwnerId: z.string().uuid().optional().nullable(),
  salesOwnerName: z.string().max(150).optional().nullable(),
  designerId: z.string().uuid().optional().nullable(),
  designerName: z.string().max(150).optional().nullable(),

  grossSubtotal: z.number().nonnegative().default(0),
  discountType: z.preprocess((val) => {
    if (typeof val === "string") {
      if (val === "fixedAmount" || val === "fixed_amount") return QuotationDiscountType.FIXED_AMOUNT;
      if (val === "percentage") return QuotationDiscountType.PERCENTAGE;
      const upper = val.toUpperCase();
      if (Object.values(QuotationDiscountType).includes(upper as any)) {
        return upper;
      }
    }
    return val;
  }, z.nativeEnum(QuotationDiscountType).default(QuotationDiscountType.PERCENTAGE)),
  discountPercent: z.number().min(0).max(100).default(0),
  fixedDiscountAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  taxableAmount: z.number().nonnegative().default(0),
  gstPercent: z.number().nonnegative().default(18),
  gstAmount: z.number().nonnegative().default(0),
  grandTotal: z.number().nonnegative().default(0),
  amountPaid: z.number().nonnegative().default(0),
  targetMarginPercent: z.number().default(25),

  submissionDate: z.string().datetime().optional().nullable(),
  discountExpiryDate: z.string().datetime().optional().nullable(),

  termsAndConditions: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),

  visibilitySettings: z.record(z.string(), z.any()).optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),

  rooms: z.array(CreateQuotationRoomInputSchema).default([]),
  paymentSchedule: z.array(CreateQuotationPaymentMilestoneInputSchema).default([]),
  pdfPages: z.array(CreateQuotationPdfPageInputSchema).default([]),
});

/**
 * Query schema for GET /api/v1/quotations with multi-criteria filters and pagination
 */
export const GetQuotationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: QuotationStatusSchema.optional(),
  quotationType: z.string().trim().optional(),
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  discountExpired: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  discountExpiryFrom: z.string().datetime().optional(),
  discountExpiryTo: z.string().datetime().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  minGrandTotal: z.coerce.number().nonnegative().optional(),
  maxGrandTotal: z.coerce.number().nonnegative().optional(),
  salesOwnerId: z.string().uuid().optional(),
  designerId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "grandTotal", "quoteNumber", "discountExpiryDate", "status", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateQuotationInput = z.infer<typeof CreateQuotationSchema>;
export type GetQuotationsQueryParams = z.infer<typeof GetQuotationsQuerySchema>;

/**
 * Update Quotation validation schema (all fields configurable during creation can be updated)
 */
export const UpdateQuotationSchema = z.object({
  leadId: z.string().uuid("Invalid leadId UUID").optional(),
  customerId: z.string().uuid("Invalid customerId UUID format").optional().nullable(),
  quoteNumber: z.string().max(100).optional(),
  version: z.string().max(20).optional(),
  title: z.string().min(1, "Quotation proposal title is required").max(255).optional(),
  quotationType: z.string().max(100).optional(),
  status: QuotationStatusSchema.optional(),

  salesOwnerId: z.string().uuid().optional().nullable(),
  salesOwnerName: z.string().max(150).optional().nullable(),
  designerId: z.string().uuid().optional().nullable(),
  designerName: z.string().max(150).optional().nullable(),

  grossSubtotal: z.number().nonnegative().optional(),
  discountType: z.preprocess((val) => {
    if (typeof val === "string") {
      if (val === "fixedAmount" || val === "fixed_amount") return QuotationDiscountType.FIXED_AMOUNT;
      if (val === "percentage") return QuotationDiscountType.PERCENTAGE;
      const upper = val.toUpperCase();
      if (Object.values(QuotationDiscountType).includes(upper as any)) {
        return upper;
      }
    }
    return val;
  }, z.nativeEnum(QuotationDiscountType).optional()),
  discountPercent: z.number().min(0).max(100).optional(),
  fixedDiscountAmount: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxableAmount: z.number().nonnegative().optional(),
  gstPercent: z.number().nonnegative().optional(),
  gstAmount: z.number().nonnegative().optional(),
  grandTotal: z.number().nonnegative().optional(),
  amountPaid: z.number().nonnegative().optional(),
  targetMarginPercent: z.number().optional(),

  submissionDate: z.string().datetime().optional().nullable(),
  discountExpiryDate: z.string().datetime().optional().nullable(),

  termsAndConditions: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),

  visibilitySettings: z.record(z.string(), z.any()).optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),

  rooms: z.array(CreateQuotationRoomInputSchema).optional(),
  paymentSchedule: z.array(CreateQuotationPaymentMilestoneInputSchema).optional(),
  pdfPages: z.array(CreateQuotationPdfPageInputSchema).optional(),

  revisionNotes: z.string().max(500).optional(),
});

export type UpdateQuotationInput = z.infer<typeof UpdateQuotationSchema>;

/**
 * Schema for adjusting discount expiry date (adding/subtracting days or setting explicit date)
 */
export const AdjustQuotationExpirySchema = z.object({
  daysDelta: z.number().int().optional(),
  discountExpiryDate: z.string().datetime().optional().nullable(),
  reason: z.string().max(255).optional(),
}).refine(
  (data) => data.daysDelta !== undefined || data.discountExpiryDate !== undefined,
  {
    message: "Either daysDelta or discountExpiryDate must be provided",
  }
);

export type AdjustQuotationExpiryInput = z.infer<typeof AdjustQuotationExpirySchema>;


