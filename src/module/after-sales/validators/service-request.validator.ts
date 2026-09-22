import { z } from "zod";

export const serviceRequestPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT", "EMERGENCY"]);
export const serviceRequestStatusEnum = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_PARTS",
  "ON_HOLD",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
]);
export const serviceBillingStatusEnum = z.enum([
  "FREE_UNDER_WARRANTY",
  "CHARGEABLE_ESTIMATED",
  "INVOICED",
  "PAID",
  "WAIVED",
]);

/**
 * Validator schema for creating an after-sales service request
 */
export const createServiceRequestSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  categoryId: z.string().uuid("Invalid category ID format"),
  warrantyId: z.string().uuid("Invalid warranty ID format").optional().nullable(),
  priority: serviceRequestPriorityEnum.optional().default("MEDIUM"),
  subject: z.string().min(2, "Subject must be at least 2 characters").max(255),
  description: z.string().min(5, "Description must be at least 5 characters"),
  areaRoom: z.string().max(100).optional().nullable(),
  specificLocation: z.string().max(255).optional().nullable(),
  preferredServiceDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid preferredServiceDate").optional().nullable(),
  preferredTimeSlot: z.string().max(50).optional().nullable(),
  customerAvailabilityNotes: z.string().optional().nullable(),
  assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),
  isWarrantyCovered: z.coerce.boolean().optional().default(false),
  billingStatus: serviceBillingStatusEnum.optional().default("FREE_UNDER_WARRANTY"),
  estimatedCost: z.coerce.number().min(0).optional().nullable(),
  finalCost: z.coerce.number().min(0).optional().nullable(),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid dueDate").optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating an after-sales service request
 */
export const updateServiceRequestSchema = createServiceRequestSchema
  .omit({ projectId: true })
  .extend({
    status: serviceRequestStatusEnum.optional(),
  })
  .partial();

/**
 * Validator schema for assigning a service request
 */
export const assignServiceRequestSchema = z.object({
  assignedToId: z.string().uuid("Invalid employee ID format"),
  internalNotes: z.string().optional().nullable(),
});

/**
 * Validator schema for updating service request status
 */
export const updateServiceRequestStatusSchema = z.object({
  status: serviceRequestStatusEnum,
});

/**
 * Validator schema for resolving a service request
 */
export const resolveServiceRequestSchema = z.object({
  resolvedNotes: z.string().min(2, "Resolution notes required"),
  finalCost: z.coerce.number().min(0).optional().nullable(),
  billingStatus: serviceBillingStatusEnum.optional(),
  isPaid: z.coerce.boolean().optional(),
});

/**
 * Validator schema for reopening a service request
 */
export const reopenServiceRequestSchema = z.object({
  reopenReason: z.string().min(5, "Reopen reason must be at least 5 characters"),
});

export const stringToOptionalBoolean = z.preprocess((val) => {
  if (val === "true" || val === true) return true;
  if (val === "false" || val === false) return false;
  return undefined;
}, z.boolean().optional());

/**
 * Validator schema for listing service requests
 */
export const getServiceRequestsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  warrantyId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  priority: serviceRequestPriorityEnum.optional(),
  status: serviceRequestStatusEnum.optional(),
  billingStatus: serviceBillingStatusEnum.optional(),
  search: z.string().optional(),
  isOverdue: stringToOptionalBoolean,
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for service request ID param
 */
export const serviceRequestIdParamSchema = z.object({
  id: z.string().uuid("Invalid service request ID format"),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;
export type AssignServiceRequestInput = z.infer<typeof assignServiceRequestSchema>;
export type UpdateServiceRequestStatusInput = z.infer<typeof updateServiceRequestStatusSchema>;
export type ResolveServiceRequestInput = z.infer<typeof resolveServiceRequestSchema>;
export type ReopenServiceRequestInput = z.infer<typeof reopenServiceRequestSchema>;
export type GetServiceRequestsQueryInput = z.infer<typeof getServiceRequestsQuerySchema>;
