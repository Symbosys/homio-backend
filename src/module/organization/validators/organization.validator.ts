import { z } from "zod";

export const onboardOrganizationSchema = z.object({
  body: z.object({
    // Organization Details
    organization: z.object({
      name: z
        .string({ message: "Organization name is required" })
        .trim()
        .min(1, "Organization name cannot be empty"),
      slug: z
        .string({ message: "Organization slug is required" })
        .trim()
        .toLowerCase()
        .min(1, "Slug cannot be empty")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
      legalName: z.string().trim().nullable().optional(),
      email: z.string().trim().email("Invalid email format").nullable().optional(),
      phone: z.string().trim().nullable().optional(),
      website: z.string().trim().nullable().optional(),
      logoUrl: z
        .union([
          z.string().trim().url("Invalid logo URL"),
          z.object({
            id: z.string(),
            url: z.string(),
            bytes: z.number(),
            format: z.string(),
            provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
          }),
        ])
        .nullable()
        .optional(),
      taxId: z.string().trim().nullable().optional(), // GSTIN / Tax ID
      address: z.string().trim().nullable().optional(),
      city: z.string().trim().nullable().optional(),
      state: z.string().trim().nullable().optional(),
      country: z.string().trim().default("IN"),
      pincode: z.string().trim().nullable().optional(),
      currency: z.string().trim().length(3).default("INR"),
      timezone: z.string().trim().default("Asia/Kolkata"),
      settings: z.record(z.string(), z.any()).optional().default({}),
    }),

    // Subscription Selection
    subscription: z.object({
      planId: z.string().uuid("Invalid subscription plan ID format"),
      billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
      status: z.enum(["TRIALING", "ACTIVE"]).default("TRIALING"),
      trialDays: z.number().int().min(0).default(14),
      externalId: z.string().trim().nullable().optional(),
    }),

    // Optional Initial Admin User
    adminUser: z
      .object({
        email: z
          .string({ message: "Admin user email is required" })
          .trim()
          .toLowerCase()
          .email("Invalid email format"),
        password: z
          .string({ message: "Password is required" })
          .min(8, "Password must be at least 8 characters long"),
        firstName: z
          .string({ message: "First name is required" })
          .trim()
          .min(1, "First name cannot be empty"),
        lastName: z.string().trim().nullable().optional(),
        phone: z.string().trim().nullable().optional(),
      })
      .optional(),
  }),
});

export const updateOrganizationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid organization ID format"),
  }),
  body: z.object({
    name: z.string().trim().min(1, "Organization name cannot be empty").optional(),
    legalName: z.string().trim().nullable().optional(),
    email: z.string().trim().email("Invalid email format").nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    website: z.string().trim().nullable().optional(),
    logoUrl: z
      .union([
        z.string().trim().url("Invalid logo URL"),
        z.object({
          id: z.string(),
          url: z.string(),
          bytes: z.number(),
          format: z.string(),
          provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
        }),
      ])
      .nullable()
      .optional(),
    taxId: z.string().trim().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    city: z.string().trim().nullable().optional(),
    state: z.string().trim().nullable().optional(),
    country: z.string().trim().optional(),
    pincode: z.string().trim().nullable().optional(),
    currency: z.string().trim().length(3).optional(),
    timezone: z.string().trim().optional(),
    settings: z.record(z.string(), z.any()).optional(),
  }),
});

export const updateOrgStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid organization ID format"),
  }),
  body: z.object({
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"], {
      message: "Status must be ACTIVE, INACTIVE, SUSPENDED, or PENDING_VERIFICATION",
    }),
  }),
});

export const assignSubscriptionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid organization ID format"),
  }),
  body: z
    .object({
      planId: z.string().uuid("Invalid subscription plan ID format").optional(),
      subscriptionPlanId: z.string().uuid("Invalid subscription plan ID format").optional(),
      billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]).default("MONTHLY"),
      status: z
        .enum(["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "UNPAID", "EXPIRED", "PAUSED"])
        .default("ACTIVE"),
      trialDays: z.number().int().min(0).optional(),
      externalId: z.string().trim().nullable().optional(),
    })
    .transform((data) => ({
      ...data,
      planId: (data.planId || data.subscriptionPlanId) as string,
    }))
    .refine((data) => Boolean(data.planId), {
      message: "Subscription plan ID (planId) is required",
      path: ["planId"],
    }),
});

export const orgIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid organization ID format"),
  }),
});

export const getOrganizationsQuerySchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .refine((val) => val > 0, { message: "Page must be greater than 0" }),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10))
      .refine((val) => val > 0 && val <= 100, { message: "Limit must be between 1 and 100" }),
    search: z.string().trim().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"]).optional(),
  }),
});

export type OnboardOrganizationInput = z.infer<typeof onboardOrganizationSchema>["body"];
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>["body"];
export type UpdateOrgStatusInput = z.infer<typeof updateOrgStatusSchema>["body"];
export type AssignSubscriptionInput = z.infer<typeof assignSubscriptionSchema>["body"];
export type GetOrganizationsQueryInput = z.infer<typeof getOrganizationsQuerySchema>["query"];

