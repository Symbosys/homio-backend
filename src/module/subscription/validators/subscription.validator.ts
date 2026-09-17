import { z } from "zod";

export const planFeatureSchema = z.object({
  maxUser: z
    .number({ message: "maxUser must be a number" })
    .int("maxUser must be an integer")
    .min(1, "maxUser must be at least 1")
    .default(5),
  maxEmployee: z
    .number({ message: "maxEmployee must be a number" })
    .int("maxEmployee must be an integer")
    .min(1, "maxEmployee must be at least 1")
    .default(10),
});

export const createPlanSchema = z.object({
  body: z.object({
    name: z
      .string({ message: "Plan name is required" })
      .trim()
      .min(1, "Plan name cannot be empty"),
    slug: z
      .string({ message: "Slug is required" })
      .trim()
      .toLowerCase()
      .min(1, "Slug cannot be empty")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
    description: z.string().trim().nullable().optional(),
    priceMonthly: z
      .number({ message: "priceMonthly must be a number" })
      .min(0, "priceMonthly cannot be negative")
      .default(0),
    priceYearly: z
      .number({ message: "priceYearly must be a number" })
      .min(0, "priceYearly cannot be negative")
      .default(0),
    currency: z
      .string()
      .trim()
      .length(3, "Currency code must be 3 characters (e.g. INR)")
      .default("INR"),
    features: z.record(z.string(), z.any()).optional().default({}),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
    planFeature: planFeatureSchema.optional().default({
      maxUser: 5,
      maxEmployee: 10,
    }),
  }),
});

export const updatePlanSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid plan ID format"),
  }),
  body: z.object({
    name: z.string().trim().min(1, "Plan name cannot be empty").optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Slug cannot be empty")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens")
      .optional(),
    description: z.string().trim().nullable().optional(),
    priceMonthly: z.number().min(0, "priceMonthly cannot be negative").optional(),
    priceYearly: z.number().min(0, "priceYearly cannot be negative").optional(),
    currency: z.string().trim().length(3).optional(),
    features: z.record(z.string(), z.any()).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    planFeature: planFeatureSchema.partial().optional(),
  }),
});

export const planIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid plan ID format"),
  }),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>["body"];
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>["body"];
