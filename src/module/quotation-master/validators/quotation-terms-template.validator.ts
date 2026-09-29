import { z } from "zod";

/**
 * URL parameter schema for Terms Template ID
 */
export const termsTemplateIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Terms Template ID format"),
  }),
});

/**
 * Validator schema for creating a Terms Template
 */
export const createTermsTemplateSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Template name is required").max(150, "Name cannot exceed 150 characters"),
    code: z.string().max(50).optional().nullable(),
    description: z.string().optional().nullable(),
    termsAndConditions: z.string().min(1, "Terms and conditions content is required"),
    warrantyClauses: z.string().optional().nullable(),
    paymentTermsNote: z.string().optional().nullable(),
    clientSignoffNote: z.string().optional().nullable(),
    isDefault: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating a Terms Template (Partial / Dirty update)
 */
export const updateTermsTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Terms Template ID format"),
  }),
  body: z.object({
    name: z.string().min(1).max(150).optional(),
    code: z.string().max(50).optional().nullable(),
    description: z.string().optional().nullable(),
    termsAndConditions: z.string().min(1).optional(),
    warrantyClauses: z.string().optional().nullable(),
    paymentTermsNote: z.string().optional().nullable(),
    clientSignoffNote: z.string().optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for listing non-paginated terms templates
 */
export const getTermsTemplatesQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
  }),
});

/**
 * Validator schema for duplicating a terms template
 */
export const duplicateTermsTemplateSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid Terms Template ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "New template name is required").max(150),
    code: z.string().max(50).optional().nullable(),
  }),
});

export type CreateTermsTemplateInput = z.infer<typeof createTermsTemplateSchema>["body"];
export type UpdateTermsTemplateInput = z.infer<typeof updateTermsTemplateSchema>["body"];
export type GetTermsTemplatesQueryInput = z.infer<typeof getTermsTemplatesQuerySchema>["query"];
export type DuplicateTermsTemplateInput = z.infer<typeof duplicateTermsTemplateSchema>["body"];
