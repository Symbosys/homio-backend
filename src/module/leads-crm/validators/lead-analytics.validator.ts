import { z } from "zod";

export const leadAnalyticsQuerySchema = z.object({
  query: z.object({
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    assignedToId: z.string().uuid("Invalid employee ID").optional(),
  }),
});

export type LeadAnalyticsQueryInput = z.infer<typeof leadAnalyticsQuerySchema>["query"];
