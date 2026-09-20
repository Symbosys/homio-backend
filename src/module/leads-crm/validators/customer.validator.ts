import { z } from "zod";

// Enums matching schema
export const CustomerTypeEnum = z.enum(["LEAD_CUSTOMER", "CLIENT"]);
export const CustomerStatusEnum = z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED", "ARCHIVED"]);
export const CustomerSalutationEnum = z.enum(["MR", "MRS", "MS", "DR", "AR", "OTHER"]);

export const customerIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID format"),
  }),
});

export const createCustomerSchema = z.object({
  body: z.object({
    salutation: CustomerSalutationEnum.optional().nullable(),
    firstName: z.string().min(1, "First name is required").max(100),
    lastName: z.string().max(100).optional().nullable(),
    displayName: z.string().max(150).optional().nullable(),
    email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
    phone: z.string().min(5, "Valid phone number is required").max(20),
    alternatePhone: z.string().max(20).optional().nullable().or(z.literal("")),
    companyName: z.string().max(150).optional().nullable(),
    gstin: z.string().max(30).optional().nullable(),
    panNumber: z.string().max(20).optional().nullable(),
    status: CustomerStatusEnum.default("ACTIVE").optional(),
    tags: z.array(z.string()).default([]).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    
    // Addresses
    billingAddress: z.string().max(500).optional().nullable(),
    billingCity: z.string().max(100).optional().nullable(),
    billingState: z.string().max(100).optional().nullable(),
    billingCountry: z.string().max(100).default("IN").optional(),
    billingPincode: z.string().max(20).optional().nullable(),

    shippingAddress: z.string().max(500).optional().nullable(),
    shippingCity: z.string().max(100).optional().nullable(),
    shippingState: z.string().max(100).optional().nullable(),
    shippingCountry: z.string().max(100).default("IN").optional(),
    shippingPincode: z.string().max(20).optional().nullable(),

    preferredContactMethod: z.string().default("PHONE").optional(),
  }),
});

export const updateCustomerSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID format"),
  }),
  body: z.object({
    salutation: CustomerSalutationEnum.optional().nullable(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().max(100).optional().nullable(),
    displayName: z.string().max(150).optional().nullable(),
    email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
    phone: z.string().min(5).max(20).optional(),
    alternatePhone: z.string().max(20).optional().nullable().or(z.literal("")),
    companyName: z.string().max(150).optional().nullable(),
    gstin: z.string().max(30).optional().nullable(),
    panNumber: z.string().max(20).optional().nullable(),
    status: CustomerStatusEnum.optional(),
    customerType: CustomerTypeEnum.optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),

    billingAddress: z.string().max(500).optional().nullable(),
    billingCity: z.string().max(100).optional().nullable(),
    billingState: z.string().max(100).optional().nullable(),
    billingCountry: z.string().max(100).optional(),
    billingPincode: z.string().max(20).optional().nullable(),

    shippingAddress: z.string().max(500).optional().nullable(),
    shippingCity: z.string().max(100).optional().nullable(),
    shippingState: z.string().max(100).optional().nullable(),
    shippingCountry: z.string().max(100).optional(),
    shippingPincode: z.string().max(20).optional().nullable(),

    preferredContactMethod: z.string().optional(),
    portalAccessEnabled: z.boolean().optional(),
  }),
});

export const togglePortalAccessSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID format"),
  }),
  body: z.object({
    portalAccessEnabled: z.boolean(),
  }),
});

export const getCustomersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    customerType: CustomerTypeEnum.optional(),
    status: CustomerStatusEnum.optional(),
    city: z.string().optional(),
    sortBy: z.enum(["createdAt", "firstName", "lastInquiryDate", "totalInquiriesCount", "customerCode"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>["body"];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>["body"];
export type GetCustomersQueryInput = z.infer<typeof getCustomersQuerySchema>["query"];
