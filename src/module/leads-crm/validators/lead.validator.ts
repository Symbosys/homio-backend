import { z } from "zod";

// Enums matching schema
export const LeadStatusEnum = z.enum([
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "SITE_VISIT_SCHEDULED",
  "SITE_VISIT_COMPLETED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "JUNK",
]);

export const LeadSourceEnum = z.enum([
  "WEBSITE",
  "META_ADS",
  "GOOGLE_ADS",
  "INSTAGRAM",
  "REFERRAL",
  "WALK_IN",
  "PHONE_INQUIRY",
  "PROPERTY_PORTAL",
  "CHANNEL_PARTNER",
  "EXHIBITION",
  "OFFLINE_CAMPAIGN",
  "OTHER",
]);

export const LeadPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const leadIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
});

export const customerPayloadSchema = z.object({
  salutation: z.enum(["MR", "MRS", "MS", "DR", "AR", "OTHER"]).optional().nullable(),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional().nullable(),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().min(5, "Valid phone number is required").max(20),
  alternatePhone: z.string().max(20).optional().nullable().or(z.literal("")),
  companyName: z.string().max(150).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  billingAddress: z.string().max(500).optional().nullable(),
  billingState: z.string().max(100).optional().nullable(),
  billingPincode: z.string().max(20).optional().nullable(),
});

export const createLeadSchema = z.object({
  body: z.object({
    // Can link an existing customerId OR supply new customer details
    customerId: z.string().uuid("Invalid customer ID format").optional().nullable(),
    customer: customerPayloadSchema.optional(),

    title: z.string().min(1, "Lead title is required").max(200),
    // Free-form Scope of Work (passed directly from frontend)
    scopeOfWork: z.string().optional().nullable(),

    status: LeadStatusEnum.default("NEW").optional(),
    source: LeadSourceEnum.default("WEBSITE").optional(),
    priority: LeadPriorityEnum.default("MEDIUM").optional(),

    // Property details
    propertyType: z.string().max(100).optional().nullable(),
    propertySizeSqft: z.coerce.number().positive().optional().nullable(),
    propertyAddress: z.string().max(500).optional().nullable(),
    propertyCity: z.string().max(100).optional().nullable(),
    propertyPincode: z.string().max(20).optional().nullable(),
    possessionStatus: z.string().max(100).optional().nullable(),
    possessionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),

    // Commercials & Scoring
    estimatedBudget: z.coerce.number().nonnegative().optional().nullable(),
    currency: z.string().default("INR").optional(),
    qualificationScore: z.coerce.number().int().min(0).max(100).default(0).optional(),

    // Assignment
    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),

    tags: z.array(z.string()).default([]).optional(),
    notes: z.string().max(3000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }).refine((data) => data.customerId || (data.customer && data.customer.firstName && data.customer.phone), {
    message: "Either customerId or customer details (with firstName and phone) must be provided",
    path: ["customerId"],
  }),
});

export const updateLeadSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    scopeOfWork: z.string().optional().nullable(),
    status: LeadStatusEnum.optional(),
    source: LeadSourceEnum.optional(),
    priority: LeadPriorityEnum.optional(),

    propertyType: z.string().max(100).optional().nullable(),
    propertySizeSqft: z.coerce.number().positive().optional().nullable(),
    propertyAddress: z.string().max(500).optional().nullable(),
    propertyCity: z.string().max(100).optional().nullable(),
    propertyPincode: z.string().max(20).optional().nullable(),
    possessionStatus: z.string().max(100).optional().nullable(),
    possessionDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),

    estimatedBudget: z.coerce.number().nonnegative().optional().nullable(),
    currency: z.string().optional(),
    qualificationScore: z.coerce.number().int().min(0).max(100).optional(),

    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),

    tags: z.array(z.string()).optional(),
    notes: z.string().max(3000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
    customer: customerPayloadSchema.partial().optional(),
  }),
});

export const updateLeadStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    status: LeadStatusEnum,
    remarks: z.string().max(1000).optional().nullable(),
    durationMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
  }),
});

export const assignLeadSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    assignedToId: z.string().uuid("Invalid employee ID").nullable(),
  }),
});

export const convertLeadSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    convertedProjectId: z.string().uuid("Invalid project ID").optional().nullable(),
    clientPortalAccess: z.boolean().default(false).optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

export const markLeadLostSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    lostReason: z.string().min(1, "Lost reason is required").max(200),
    lostRemarks: z.string().max(2000).optional().nullable(),
  }),
});

export const bulkActionLeadsSchema = z.object({
  body: z.object({
    leadIds: z.array(z.string().uuid("Invalid lead ID format")).min(1, "At least one lead ID is required"),
    action: z.enum(["ASSIGN", "UPDATE_STATUS", "DELETE"]),
    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),
    status: LeadStatusEnum.optional(),
  }).refine(
    (data) => {
      if (data.action === "ASSIGN" && data.assignedToId === undefined) return false;
      if (data.action === "UPDATE_STATUS" && !data.status) return false;
      return true;
    },
    {
      message: "Missing required fields for selected bulk action",
      path: ["action"],
    }
  ),
});

export const getLeadsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    status: LeadStatusEnum.optional(),
    source: LeadSourceEnum.optional(),
    priority: LeadPriorityEnum.optional(),
    assignedToId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    possessionStatus: z.string().optional(),
    propertyCity: z.string().optional(),
    minBudget: z.coerce.number().nonnegative().optional(),
    maxBudget: z.coerce.number().nonnegative().optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "estimatedBudget", "qualificationScore", "priority", "leadCode"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>["body"];
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>["body"];
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>["body"];
export type AssignLeadInput = z.infer<typeof assignLeadSchema>["body"];
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>["body"];
export type MarkLeadLostInput = z.infer<typeof markLeadLostSchema>["body"];
export type BulkActionLeadsInput = z.infer<typeof bulkActionLeadsSchema>["body"];
export type GetLeadsQueryInput = z.infer<typeof getLeadsQuerySchema>["query"];
