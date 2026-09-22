import { z } from "zod";
import {
  ProjectHandoverStatus,
  HandoverItemCategory,
  HandoverItemStatus,
  HandoverSnagSeverity,
  HandoverSnagStatus,
} from "../../../types/types.js";

// ==========================================
// PREPROCESSORS & SHARED UTILS
// ==========================================

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

export const stringToBoolean = (defaultVal = false) =>
  z.preprocess((val) => {
    if (val === "true" || val === true) return true;
    if (val === "false" || val === false) return false;
    return val;
  }, z.boolean().optional().default(defaultVal));

// ==========================================
// ZOD ENUMS
// ==========================================

export const ProjectHandoverStatusEnum = z.enum([
  ProjectHandoverStatus.DRAFT,
  ProjectHandoverStatus.SCHEDULED,
  ProjectHandoverStatus.INSPECTION_PENDING,
  ProjectHandoverStatus.SNAGS_IN_PROGRESS,
  ProjectHandoverStatus.CLIENT_REVIEW,
  ProjectHandoverStatus.ACCEPTED,
  ProjectHandoverStatus.REJECTED,
  ProjectHandoverStatus.COMPLETED,
  ProjectHandoverStatus.CANCELLED,
]);

export const HandoverItemCategoryEnum = z.enum([
  HandoverItemCategory.KEYS,
  HandoverItemCategory.ACCESS_CARD_OR_REMOTE,
  HandoverItemCategory.APPLIANCE_MANUAL,
  HandoverItemCategory.WARRANTY_DOCUMENT,
  HandoverItemCategory.AS_BUILT_DRAWING,
  HandoverItemCategory.MAINTENANCE_GUIDE,
  HandoverItemCategory.SPARE_MATERIAL,
  HandoverItemCategory.OTHER,
]);

export const HandoverItemStatusEnum = z.enum([
  HandoverItemStatus.PENDING,
  HandoverItemStatus.VERIFIED,
  HandoverItemStatus.HANDED_OVER,
  HandoverItemStatus.NOT_APPLICABLE,
]);

export const HandoverSnagSeverityEnum = z.enum([
  HandoverSnagSeverity.LOW,
  HandoverSnagSeverity.MEDIUM,
  HandoverSnagSeverity.HIGH,
  HandoverSnagSeverity.CRITICAL,
]);

export const HandoverSnagStatusEnum = z.enum([
  HandoverSnagStatus.REPORTED,
  HandoverSnagStatus.IN_PROGRESS,
  HandoverSnagStatus.RESOLVED,
  HandoverSnagStatus.ACCEPTED_BY_CLIENT,
  HandoverSnagStatus.WAIVED,
]);

// ==========================================
// DELIVERABLE ITEM SCHEMAS
// ==========================================

export const createHandoverItemSchema = z.object({
  category: HandoverItemCategoryEnum.optional().default(HandoverItemCategory.KEYS),
  name: z.string().min(1, "Item name is required").max(255),
  description: z.string().optional().nullable(),
  quantity: stringToNumber(1),
  unit: z.string().max(50).optional().default("PCS"),
  status: HandoverItemStatusEnum.optional().default(HandoverItemStatus.PENDING),
  handedOverAt: z.string().datetime().optional().nullable(),
  recipientName: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const updateHandoverItemSchema = createHandoverItemSchema.partial();

export const updateHandoverItemStatusSchema = z.object({
  status: HandoverItemStatusEnum,
  handedOverAt: z.string().datetime().optional(),
  recipientName: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const bulkHandoverItemsSchema = z.object({
  itemIds: z.array(z.string().uuid("Invalid item ID")).min(1, "At least one item required"),
  recipientName: z.string().min(1, "Recipient name is required").max(255),
  notes: z.string().optional(),
});

// ==========================================
// PRE-HANDOVER PUNCH-LIST / SNAG SCHEMAS
// ==========================================

export const createHandoverSnagSchema = z.object({
  complaintId: z.string().uuid("Invalid Complaint ID").optional().nullable(),
  areaRoom: z.string().max(255).optional().nullable(),
  title: z.string().min(1, "Snag title is required").max(255),
  description: z.string().optional().nullable(),
  severity: HandoverSnagSeverityEnum.optional().default(HandoverSnagSeverity.LOW),
  status: HandoverSnagStatusEnum.optional().default(HandoverSnagStatus.REPORTED),
  assignedToId: z.string().uuid("Invalid Assigned Employee ID").optional().nullable(),
  targetResolutionDate: z.string().optional().nullable(), // ISO Date string (YYYY-MM-DD)
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const updateHandoverSnagSchema = createHandoverSnagSchema.partial();

export const resolveHandoverSnagSchema = z.object({
  resolvedNotes: z.string().min(1, "Resolution notes are required"),
  resolvedAt: z.string().datetime().optional(),
});

export const verifyHandoverSnagSchema = z.object({
  status: z.enum([HandoverSnagStatus.ACCEPTED_BY_CLIENT, HandoverSnagStatus.WAIVED]),
  verificationNotes: z.string().optional(),
});

// ==========================================
// ROOT PROJECT HANDOVER SCHEMAS
// ==========================================

export const createHandoverSchema = z.object({
  projectId: z.string().uuid("Invalid Project ID"),
  customerId: z.string().uuid("Invalid Customer ID").optional(),
  handoverNumber: z.string().max(50).optional(),
  title: z.string().min(1, "Handover title is required").max(255),
  description: z.string().optional().nullable(),
  status: ProjectHandoverStatusEnum.optional().default(ProjectHandoverStatus.DRAFT),
  scheduledDate: z.string().optional().nullable(), // YYYY-MM-DD
  inspectedDate: z.string().optional().nullable(),
  handoverDate: z.string().optional().nullable(),
  // Commercial & Finance Clearance
  isCommercialCleared: stringToBoolean(false),
  finalSettlementAmount: stringToNullableNumber,
  pendingAmount: stringToNullableNumber,
  commercialRemarks: z.string().optional().nullable(),
  // Warranty & Defect Liability Period (DLP)
  warrantyPeriodMonths: stringToNumber(12),
  warrantyStartDate: z.string().optional().nullable(),
  warrantyEndDate: z.string().optional().nullable(),
  warrantyTerms: z.string().optional().nullable(),
  // Personnel Attribution
  handedOverById: z.string().uuid("Invalid Handover Officer ID").optional().nullable(),
  // Initial Nested Items & Snags (optional batch creation)
  items: z.array(createHandoverItemSchema).optional().default([]),
  snags: z.array(createHandoverSnagSchema).optional().default([]),
  // Universal Custom Fields & Metadata
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const updateHandoverSchema = createHandoverSchema
  .omit({ projectId: true, customerId: true, items: true, snags: true })
  .partial();

export const updateHandoverStatusSchema = z.object({
  status: ProjectHandoverStatusEnum,
  statusNotes: z.string().optional(),
});

export const commercialClearanceSchema = z.object({
  isCommercialCleared: stringToBoolean(true),
  finalSettlementAmount: z.number().nonnegative().optional(),
  pendingAmount: z.number().nonnegative().optional().default(0),
  commercialRemarks: z.string().optional().nullable(),
});

export const handoverSignoffSchema = z.object({
  clientSignoffName: z.string().min(1, "Client signoff name is required").max(255),
  clientSignedAt: z.string().datetime().optional(),
  clientFeedback: z.string().optional().nullable(),
  clientRating: stringToNullableNumber.refine(
    (val) => val === null || val === undefined || (val >= 1 && val <= 5),
    "Client rating must be between 1.0 and 5.0"
  ),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

// ==========================================
// QUERY PARAMETERS SCHEMAS
// ==========================================

export const getHandoversQuerySchema = z.object({
  page: stringToNumber(1),
  limit: stringToNumber(10),
  search: z.string().optional(),
  projectId: z.string().uuid("Invalid Project ID").optional(),
  customerId: z.string().uuid("Invalid Customer ID").optional(),
  status: ProjectHandoverStatusEnum.optional(),
  isCommercialCleared: z
    .preprocess((val) => {
      if (val === "true" || val === true) return true;
      if (val === "false" || val === false) return false;
      return undefined;
    }, z.boolean().optional()),
  handedOverById: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const getHandoverItemsQuerySchema = z.object({
  category: HandoverItemCategoryEnum.optional(),
  status: HandoverItemStatusEnum.optional(),
  search: z.string().optional(),
});

export const getHandoverSnagsQuerySchema = z.object({
  severity: HandoverSnagSeverityEnum.optional(),
  status: HandoverSnagStatusEnum.optional(),
  areaRoom: z.string().optional(),
  assignedToId: z.string().uuid().optional(),
});

// ==========================================
// ROUTE PARAMETERS SCHEMAS
// ==========================================

export const handoverIdParamSchema = z.object({
  id: z.string().uuid("Invalid Handover ID"),
});

export const handoverItemParamSchema = z.object({
  handoverId: z.string().uuid("Invalid Handover ID"),
  itemId: z.string().uuid("Invalid Handover Item ID"),
});

export const handoverSnagParamSchema = z.object({
  handoverId: z.string().uuid("Invalid Handover ID"),
  snagId: z.string().uuid("Invalid Handover Snag ID"),
});

// ==========================================
// INFERRED TYPES
// ==========================================

export type CreateHandoverInput = z.infer<typeof createHandoverSchema>;
export type UpdateHandoverInput = z.infer<typeof updateHandoverSchema>;
export type UpdateHandoverStatusInput = z.infer<typeof updateHandoverStatusSchema>;
export type CommercialClearanceInput = z.infer<typeof commercialClearanceSchema>;
export type HandoverSignoffInput = z.infer<typeof handoverSignoffSchema>;

export type CreateHandoverItemInput = z.infer<typeof createHandoverItemSchema>;
export type UpdateHandoverItemInput = z.infer<typeof updateHandoverItemSchema>;
export type UpdateHandoverItemStatusInput = z.infer<typeof updateHandoverItemStatusSchema>;
export type BulkHandoverItemsInput = z.infer<typeof bulkHandoverItemsSchema>;

export type CreateHandoverSnagInput = z.infer<typeof createHandoverSnagSchema>;
export type UpdateHandoverSnagInput = z.infer<typeof updateHandoverSnagSchema>;
export type ResolveHandoverSnagInput = z.infer<typeof resolveHandoverSnagSchema>;
export type VerifyHandoverSnagInput = z.infer<typeof verifyHandoverSnagSchema>;

export type GetHandoversQueryInput = z.infer<typeof getHandoversQuerySchema>;
export type GetHandoverItemsQueryInput = z.infer<typeof getHandoverItemsQuerySchema>;
export type GetHandoverSnagsQueryInput = z.infer<typeof getHandoverSnagsQuerySchema>;
