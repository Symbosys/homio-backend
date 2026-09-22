import { z } from "zod";

/**
 * Validator schema for project analytics param
 */
export const projectAnalyticsParamSchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
});

/**
 * Validator schema for overview analytics query
 */
export const getAnalyticsOverviewQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ProjectAnalyticsParamInput = z.infer<typeof projectAnalyticsParamSchema>;
export type GetAnalyticsOverviewQueryInput = z.infer<typeof getAnalyticsOverviewQuerySchema>;
