import { z } from "zod";
import {
  MaterialDispatchStatus,
  MaterialItemCondition,
} from "../../../types/types.js";
import { stringToNumber } from "./material-request.validator.js";

export const materialDispatchStatusEnum = z.enum([
  MaterialDispatchStatus.PLANNED,
  MaterialDispatchStatus.IN_TRANSIT,
  MaterialDispatchStatus.DELIVERED,
  MaterialDispatchStatus.RECEIVED,
  MaterialDispatchStatus.PARTIALLY_RECEIVED,
  MaterialDispatchStatus.REJECTED,
  MaterialDispatchStatus.CANCELLED,
]);

export const materialItemConditionEnum = z.enum([
  MaterialItemCondition.GOOD,
  MaterialItemCondition.DAMAGED,
  MaterialItemCondition.SHORT,
  MaterialItemCondition.WRONG_ITEM,
  MaterialItemCondition.REJECTED,
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
 * Schema for single Material Dispatch Item creation
 */
export const createDispatchItemSchema = z.object({
  materialProductId: z.string().uuid("Invalid Material Product ID").optional().nullable(),
  name: z.string().min(1, "Item name is required").max(255),
  unit: z.string().min(1, "Unit is required").max(50),
  dispatchedQuantity: z.number().positive("Dispatched quantity must be greater than 0"),
  receivedQuantity: z.number().nonnegative().optional().default(0),
  acceptedQuantity: z.number().nonnegative().optional().default(0),
  rejectedQuantity: z.number().nonnegative().optional().default(0),
  condition: materialItemConditionEnum.optional().default(MaterialItemCondition.GOOD),
  batchLot: z.string().max(100).optional().nullable(),
  remarks: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for single Material Dispatch Item update
 */
export const updateDispatchItemSchema = createDispatchItemSchema.partial();

/**
 * Schema for Bulk Item Reception update within a Dispatch
 */
export const bulkReceiveItemSchema = z.object({
  id: z.string().uuid("Invalid Dispatch Item ID"),
  receivedQuantity: z.number().nonnegative("Received quantity must be non-negative"),
  acceptedQuantity: z.number().nonnegative("Accepted quantity must be non-negative"),
  rejectedQuantity: z.number().nonnegative("Rejected quantity must be non-negative").default(0),
  condition: materialItemConditionEnum.default(MaterialItemCondition.GOOD),
  remarks: z.string().optional().nullable(),
});

export const bulkReceiveDispatchSchema = z.object({
  actualArrival: dateOrDatetimeSchema.optional(),
  siteInspectionNotes: z.string().optional().nullable(),
  status: materialDispatchStatusEnum.optional().default(MaterialDispatchStatus.RECEIVED),
  items: z.array(bulkReceiveItemSchema).min(1, "At least one item must be verified"),
});

/**
 * Schema for Material Dispatch Creation
 */
export const createMaterialDispatchSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID"),
  vendorId: z.string().uuid("Invalid Vendor ID"),
  materialRequestId: z.string().uuid("Invalid Material Request ID").optional().nullable(),
  quotationId: z.string().uuid("Invalid Quotation ID").optional().nullable(),
  dispatchNumber: z.string().max(50).optional(),
  dispatchDate: dateOrDatetimeSchema.optional(),
  expectedArrival: dateOrDatetimeSchema,
  actualArrival: dateOrDatetimeSchema.optional().nullable(),
  status: materialDispatchStatusEnum.optional().default(MaterialDispatchStatus.IN_TRANSIT),
  destinationAddress: z.string().optional().nullable(),
  transporterName: z.string().max(255).optional().nullable(),
  vehicleNumber: z.string().max(50).optional().nullable(),
  driverContact: z.string().max(50).optional().nullable(),
  challanNumber: z.string().max(100).optional().nullable(),
  eWayBillNumber: z.string().max(100).optional().nullable(),
  freightAmount: z.number().nonnegative().optional().default(0),
  deliveryProofUrl: z.any().optional().nullable(),
  siteSupervisorSignature: z.any().optional().nullable(),
  siteInspectionNotes: z.string().optional().nullable(),
  receivedById: z.string().uuid().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(createDispatchItemSchema).optional().default([]),
});

/**
 * Schema for Material Dispatch Update
 */
export const updateMaterialDispatchSchema = createMaterialDispatchSchema
  .omit({ projectId: true, vendorId: true, items: true })
  .partial();

/**
 * Schema for Dispatch Status Transition
 */
export const updateMaterialDispatchStatusSchema = z.object({
  status: materialDispatchStatusEnum,
  actualArrival: dateOrDatetimeSchema.optional(),
  siteInspectionNotes: z.string().optional(),
});

/**
 * Schema for Material Dispatch List Query Parameters
 */
export const getMaterialDispatchesQuerySchema = z.object({
  page: stringToNumber(1),
  limit: stringToNumber(10),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  materialRequestId: z.string().uuid().optional(),
  quotationId: z.string().uuid().optional(),
  status: materialDispatchStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Parameter validation schemas
 */
export const materialDispatchIdParamSchema = z.object({
  id: z.string().uuid("Invalid Dispatch ID"),
});

export const dispatchItemParamSchema = z.object({
  dispatchId: z.string().uuid("Invalid Dispatch ID"),
  itemId: z.string().uuid("Invalid Dispatch Item ID"),
});

export type CreateMaterialDispatchInput = z.infer<typeof createMaterialDispatchSchema>;
export type UpdateMaterialDispatchInput = z.infer<typeof updateMaterialDispatchSchema>;
export type CreateDispatchItemInput = z.infer<typeof createDispatchItemSchema>;
export type UpdateDispatchItemInput = z.infer<typeof updateDispatchItemSchema>;
export type BulkReceiveDispatchInput = z.infer<typeof bulkReceiveDispatchSchema>;
export type GetMaterialDispatchesQueryInput = z.infer<typeof getMaterialDispatchesQuerySchema>;
export type UpdateMaterialDispatchStatusInput = z.infer<typeof updateMaterialDispatchStatusSchema>;
