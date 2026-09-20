import { z } from "zod";

export const activityIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid activity ID format"),
  }),
});

export const createLeadActivitySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid lead ID format"),
  }),
  body: z.object({
    type: z.string().min(1, "Activity type is required").max(50), // CALL, MEETING, SITE_VISIT, NOTE, WHATSAPP, EMAIL
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional().nullable(),
    performedById: z.string().uuid("Invalid employee ID").optional().nullable(),
    performedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const createCustomerActivitySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid customer ID format"),
  }),
  body: z.object({
    type: z.string().min(1, "Activity type is required").max(50), // CALL, MEETING, EMAIL, WHATSAPP, SITE_VISIT, NOTE
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional().nullable(),
    performedById: z.string().uuid("Invalid employee ID").optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export type CreateLeadActivityInput = z.infer<typeof createLeadActivitySchema>["body"];
export type CreateCustomerActivityInput = z.infer<typeof createCustomerActivitySchema>["body"];
