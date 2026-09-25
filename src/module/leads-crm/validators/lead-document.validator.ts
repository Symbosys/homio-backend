import { z } from "zod";

export const documentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid document ID format"),
  }),
});

export const uploadLeadDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "Document name is required").max(150),
    category: z.string().default("OTHER").optional(), // FLOOR_PLAN, SITE_PHOTO, MOODBOARD, ESTIMATE, OTHER
  }),
});

export const uploadCustomerDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "Document name is required").max(150),
    category: z.string().default("OTHER").optional(), // KYC_ID, AGREEMENT, SITE_DEED, OTHER
  }),
});

export const updateLeadDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid document ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "Document name is required").max(150).optional(),
    category: z.string().optional(),
  }),
});

export type UploadLeadDocumentInput = z.infer<typeof uploadLeadDocumentSchema>["body"];
export type UpdateLeadDocumentInput = z.infer<typeof updateLeadDocumentSchema>["body"];
export type UploadCustomerDocumentInput = z.infer<typeof uploadCustomerDocumentSchema>["body"];

