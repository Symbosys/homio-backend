import { z } from "zod";
import {
  MaterialRequestPriority,
  VendorRfqStatus,
  RfqInviteStatus,
} from "../../../types/types.js";
import {
  stringToNumber,
  materialRequestPriorityEnum,
} from "./material-request.validator.js";

export const vendorRfqStatusEnum = z.enum([
  VendorRfqStatus.DRAFT,
  VendorRfqStatus.SENT,
  VendorRfqStatus.RESPONSES_RECEIVED,
  VendorRfqStatus.CLOSED,
  VendorRfqStatus.CANCELLED,
  VendorRfqStatus.EXPIRED,
]);

export const rfqInviteStatusEnum = z.enum([
  RfqInviteStatus.INVITED,
  RfqInviteStatus.VIEWED,
  RfqInviteStatus.RESPONDED,
  RfqInviteStatus.DECLINED,
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
 * Schema for single RFQ Item creation
 */
export const createRfqItemSchema = z.object({
  materialRequestItemId: z.string().uuid("Invalid Material Request Item ID").optional().nullable(),
  materialProductId: z.string().uuid("Invalid Material Product ID").optional().nullable(),
  name: z.string().min(1, "Item name is required").max(255),
  specifications: z.string().optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required").max(50),
  targetRate: z.number().nonnegative().optional().nullable(),
  requiredDate: dateOrDatetimeSchema,
  notes: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for single RFQ Item update
 */
export const updateRfqItemSchema = createRfqItemSchema.partial();

/**
 * Schema for Vendor RFQ Invite creation
 */
export const createRfqInviteSchema = z.object({
  vendorId: z.string().uuid("Invalid Vendor ID"),
  notes: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for Vendor RFQ Invite update
 */
export const updateRfqInviteSchema = z.object({
  status: rfqInviteStatusEnum.optional(),
  respondedAt: dateOrDatetimeSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for Vendor RFQ Creation
 */
export const createVendorRfqSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID"),
  materialRequestId: z.string().uuid("Invalid Material Request ID").optional().nullable(),
  rfqNumber: z.string().max(50).optional(),
  title: z.string().min(1, "Title is required").max(255),
  rfqDate: dateOrDatetimeSchema.optional(),
  deadline: dateOrDatetimeSchema,
  priority: materialRequestPriorityEnum.optional().default(MaterialRequestPriority.NORMAL),
  status: vendorRfqStatusEnum.optional().default(VendorRfqStatus.SENT),
  deliveryLocation: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdById: z.string().uuid().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(createRfqItemSchema).optional().default([]),
  vendorIds: z.array(z.string().uuid()).optional().default([]),
});

/**
 * Schema for Vendor RFQ Update
 */
export const updateVendorRfqSchema = createVendorRfqSchema
  .omit({ projectId: true, items: true, vendorIds: true })
  .partial();

/**
 * Schema for RFQ Status Transition
 */
export const updateVendorRfqStatusSchema = z.object({
  status: vendorRfqStatusEnum,
  notes: z.string().optional(),
});

/**
 * Schema for Vendor RFQ List Query Parameters
 */
export const getVendorRfqsQuerySchema = z.object({
  page: stringToNumber(1),
  limit: stringToNumber(10),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  materialRequestId: z.string().uuid().optional(),
  status: vendorRfqStatusEnum.optional(),
  priority: materialRequestPriorityEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Parameter validation schemas
 */
export const vendorRfqIdParamSchema = z.object({
  id: z.string().uuid("Invalid RFQ ID"),
});

export const rfqItemParamSchema = z.object({
  rfqId: z.string().uuid("Invalid RFQ ID"),
  itemId: z.string().uuid("Invalid RFQ Item ID"),
});

export const rfqInviteParamSchema = z.object({
  rfqId: z.string().uuid("Invalid RFQ ID"),
  inviteId: z.string().uuid("Invalid Invite ID"),
});

export type CreateVendorRfqInput = z.infer<typeof createVendorRfqSchema>;
export type UpdateVendorRfqInput = z.infer<typeof updateVendorRfqSchema>;
export type CreateRfqItemInput = z.infer<typeof createRfqItemSchema>;
export type UpdateRfqItemInput = z.infer<typeof updateRfqItemSchema>;
export type CreateRfqInviteInput = z.infer<typeof createRfqInviteSchema>;
export type UpdateRfqInviteInput = z.infer<typeof updateRfqInviteSchema>;
export type GetVendorRfqsQueryInput = z.infer<typeof getVendorRfqsQuerySchema>;
export type UpdateVendorRfqStatusInput = z.infer<typeof updateVendorRfqStatusSchema>;
