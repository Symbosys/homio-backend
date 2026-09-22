import { z } from "zod";
import {
  MaterialRequestPriority,
  MaterialRequestStatus,
} from "../../../types/types.js";

/**
 * Preprocessors for handling query and multipart/form-data inputs
 */
export const stringToNumber = (defaultVal = 0) =>
  z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    const num = Number(val);
    return isNaN(num) ? val : num;
  }, z.number().optional().default(defaultVal));

export const stringToNullableNumber = z.preprocess((val) => {
  if (val === undefined || val === null || val === "" || val === "null") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}, z.number().nullable().optional());

export const stringToBoolean = (defaultVal = true) =>
  z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional().default(defaultVal));

export const materialRequestPriorityEnum = z.enum([
  MaterialRequestPriority.LOW,
  MaterialRequestPriority.NORMAL,
  MaterialRequestPriority.HIGH,
  MaterialRequestPriority.URGENT,
  MaterialRequestPriority.CRITICAL,
]);

export const materialRequestStatusEnum = z.enum([
  MaterialRequestStatus.DRAFT,
  MaterialRequestStatus.SUBMITTED,
  MaterialRequestStatus.UNDER_REVIEW,
  MaterialRequestStatus.APPROVED,
  MaterialRequestStatus.REJECTED,
  MaterialRequestStatus.IN_PROCUREMENT,
  MaterialRequestStatus.PARTIALLY_FULFILLED,
  MaterialRequestStatus.FULFILLED,
  MaterialRequestStatus.CANCELLED,
]);

/**
 * Schema for single Material Request Item creation
 */
export const createMaterialRequestItemSchema = z.object({
  materialProductId: z.string().uuid("Invalid Material Product ID").optional().nullable(),
  name: z.string().min(1, "Item name is required").max(255),
  sku: z.string().max(100).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  specifications: z.string().optional().nullable(),
  dimensions: z.string().max(100).optional().nullable(),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required").max(50),
  estimatedRate: z.number().nonnegative().optional().default(0),
  estimatedAmount: z.number().nonnegative().optional(),
  approvedQuantity: z.number().nonnegative().optional().nullable(),
  requiredDate: z.string().datetime("Required date must be a valid ISO datetime"),
  notes: z.string().optional().nullable(),
  attachmentUrl: z.any().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

/**
 * Schema for single Material Request Item update
 */
export const updateMaterialRequestItemSchema = createMaterialRequestItemSchema
  .partial()
  .extend({
    fulfilledQuantity: z.number().nonnegative().optional(),
  });

/**
 * Schema for Material Request Creation
 */
export const createMaterialRequestSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID"),
  requestNumber: z.string().max(50).optional(),
  requestDate: z.string().datetime().optional(),
  requiredByDate: z.string().datetime("Required by date must be a valid ISO datetime"),
  priority: materialRequestPriorityEnum.optional().default(MaterialRequestPriority.NORMAL),
  status: materialRequestStatusEnum.optional().default(MaterialRequestStatus.SUBMITTED),
  siteLocation: z.string().max(255).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  estimatedCost: z.number().nonnegative().optional().default(0),
  approvedCost: z.number().nonnegative().optional().default(0),
  requestedById: z.string().uuid("Invalid Requested By User ID").optional().nullable(),
  approvedById: z.string().uuid("Invalid Approved By User ID").optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  items: z.array(createMaterialRequestItemSchema).optional().default([]),
});

/**
 * Schema for Material Request Update
 */
export const updateMaterialRequestSchema = createMaterialRequestSchema
  .omit({ projectId: true, items: true })
  .partial();

/**
 * Schema for Material Request Status Transition
 */
export const updateMaterialRequestStatusSchema = z.object({
  status: materialRequestStatusEnum,
  notes: z.string().optional(),
  approvedCost: z.number().nonnegative().optional(),
});

/**
 * Schema for Material Request List Query Parameters
 */
export const getMaterialRequestsQuerySchema = z.object({
  page: stringToNumber(1),
  limit: stringToNumber(10),
  search: z.string().optional(),
  projectId: z.string().uuid("Invalid Project ID").optional(),
  status: materialRequestStatusEnum.optional(),
  priority: materialRequestPriorityEnum.optional(),
  requestedById: z.string().uuid().optional(),
  approvedById: z.string().uuid().optional(),
  category: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

/**
 * Parameter validation schemas
 */
export const materialRequestIdParamSchema = z.object({
  id: z.string().uuid("Invalid Material Request ID"),
});

export const materialRequestItemParamSchema = z.object({
  requestId: z.string().uuid("Invalid Material Request ID"),
  itemId: z.string().uuid("Invalid Material Request Item ID"),
});

export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export type UpdateMaterialRequestInput = z.infer<typeof updateMaterialRequestSchema>;
export type CreateMaterialRequestItemInput = z.infer<typeof createMaterialRequestItemSchema>;
export type UpdateMaterialRequestItemInput = z.infer<typeof updateMaterialRequestItemSchema>;
export type GetMaterialRequestsQueryInput = z.infer<typeof getMaterialRequestsQuerySchema>;
export type UpdateMaterialRequestStatusInput = z.infer<typeof updateMaterialRequestStatusSchema>;
