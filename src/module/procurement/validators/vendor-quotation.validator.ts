import { z } from "zod";
import { VendorQuotationStatus } from "../../../types/types.js";
import { stringToNumber } from "./material-request.validator.js";

export const vendorQuotationStatusEnum = z.enum([
  VendorQuotationStatus.RECEIVED,
  VendorQuotationStatus.UNDER_REVIEW,
  VendorQuotationStatus.SHORTLISTED,
  VendorQuotationStatus.ACCEPTED,
  VendorQuotationStatus.REJECTED,
  VendorQuotationStatus.EXPIRED,
]);

/**
 * Reusable schema for Date or Datetime string (ISO datetime or YYYY-MM-DD)
 */
export const dateOrDatetimeSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "Must be a valid date or datetime string",
  });

/**
 * Schema for single Vendor Quotation Item creation
 */
export const createQuotationItemSchema = z.object({
  rfqItemId: z.string().uuid("Invalid RFQ Item ID").optional().nullable(),
  materialProductId: z.string().uuid("Invalid Material Product ID").optional().nullable(),
  name: z.string().min(1, "Item name is required").max(255),
  brand: z.string().max(100).optional().nullable(),
  specifications: z.string().optional().nullable(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required").max(50),
  unitRate: z.number().nonnegative("Unit rate cannot be negative"),
  taxRate: z.number().nonnegative().optional().default(18.0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  totalAmount: z.number().nonnegative().optional(),
  deliveryDays: z.string().max(50).optional().nullable(),
  remarks: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for single Vendor Quotation Item update
 */
export const updateQuotationItemSchema = createQuotationItemSchema.partial();

/**
 * Schema for Vendor Quotation Creation
 */
export const createVendorQuotationSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID"),
  vendorId: z.string().uuid("Invalid Vendor ID"),
  rfqId: z.string().uuid("Invalid RFQ ID").optional().nullable(),
  materialRequestId: z.string().uuid("Invalid Material Request ID").optional().nullable(),
  quotationNumber: z.string().max(50).optional(),
  quoteDate: dateOrDatetimeSchema.optional(),
  validUntil: dateOrDatetimeSchema,
  currency: z.string().max(10).optional().default("INR"),
  status: vendorQuotationStatusEnum.optional().default(VendorQuotationStatus.RECEIVED),
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  freight: z.number().nonnegative().optional().default(0),
  totalAmount: z.number().nonnegative().optional(),
  paymentTerms: z.string().optional().default("30 Days Net"),
  deliveryTimeline: z.string().optional().nullable(),
  warrantyPeriod: z.string().optional().nullable(),
  vendorRating: z.number().min(0).max(5).optional().nullable(),
  evaluationNotes: z.string().optional().nullable(),
  attachmentUrl: z.any().optional().nullable(),
  reviewedById: z.string().uuid().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(createQuotationItemSchema).optional().default([]),
});

/**
 * Schema for Vendor Quotation Update
 */
export const updateVendorQuotationSchema = createVendorQuotationSchema
  .omit({ projectId: true, vendorId: true, items: true })
  .partial();

/**
 * Schema for Quotation Status Transition
 */
export const updateVendorQuotationStatusSchema = z.object({
  status: vendorQuotationStatusEnum,
  evaluationNotes: z.string().optional(),
  vendorRating: z.number().min(0).max(5).optional(),
});

/**
 * Schema for Vendor Quotation List Query Parameters
 */
export const getVendorQuotationsQuerySchema = z.object({
  page: stringToNumber(1),
  limit: stringToNumber(10),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  rfqId: z.string().uuid().optional(),
  materialRequestId: z.string().uuid().optional(),
  status: vendorQuotationStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Schema for Comparing RFQ Quotations
 */
export const compareQuotationsQuerySchema = z.object({
  rfqId: z.string().uuid("Invalid RFQ ID"),
});

/**
 * Parameter validation schemas
 */
export const vendorQuotationIdParamSchema = z.object({
  id: z.string().uuid("Invalid Quotation ID"),
});

export const quotationItemParamSchema = z.object({
  quotationId: z.string().uuid("Invalid Quotation ID"),
  itemId: z.string().uuid("Invalid Quotation Item ID"),
});

export type CreateVendorQuotationInput = z.infer<typeof createVendorQuotationSchema>;
export type UpdateVendorQuotationInput = z.infer<typeof updateVendorQuotationSchema>;
export type CreateQuotationItemInput = z.infer<typeof createQuotationItemSchema>;
export type UpdateQuotationItemInput = z.infer<typeof updateQuotationItemSchema>;
export type GetVendorQuotationsQueryInput = z.infer<typeof getVendorQuotationsQuerySchema>;
export type UpdateVendorQuotationStatusInput = z.infer<typeof updateVendorQuotationStatusSchema>;
export type CompareQuotationsQueryInput = z.infer<typeof compareQuotationsQuerySchema>;
