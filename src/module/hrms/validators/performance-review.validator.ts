import { z } from "zod";

export const createPerformanceReviewSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid("Invalid employee ID"),
    reviewPeriod: z.string().min(1, "Review period is required"), // e.g. 'Q3 2026', 'Annual 2025-26'
    reviewType: z.enum(["QUARTERLY", "ANNUAL", "PROBATION", "SPECIAL"]).default("QUARTERLY"),
    reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Review date must be in YYYY-MM-DD format").optional(),
    overallScore: z.number().min(1.0, "Overall score must be at least 1.0").max(5.0, "Overall score cannot exceed 5.0"),
    kpiScores: z.record(z.string(), z.number().min(1.0).max(5.0)).default({}), // Dynamic rubrics e.g. { "Delivery Speed": 4.5, "Quality": 4.2 }
    selfReviewComments: z.string().max(2000).optional().nullable(),
    reviewerComments: z.string().max(2000).optional().nullable(),
    recommendation: z.string().default("Maintain"), // 'Promote', 'Incentive Increment', 'PIP', 'Maintain'
    recommendedHike: z.number().min(0).max(100, "Recommended hike cannot exceed 100%").optional().nullable(),
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).default("APPROVED"),
  }),
});

export const updatePerformanceReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid performance review ID"),
  }),
  body: z.object({
    reviewPeriod: z.string().min(1).optional(),
    reviewType: z.enum(["QUARTERLY", "ANNUAL", "PROBATION", "SPECIAL"]).optional(),
    reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    overallScore: z.number().min(1.0).max(5.0).optional(),
    kpiScores: z.record(z.string(), z.number().min(1.0).max(5.0)).optional(),
    selfReviewComments: z.string().max(2000).optional().nullable(),
    reviewerComments: z.string().max(2000).optional().nullable(),
    recommendation: z.string().optional(),
    recommendedHike: z.number().min(0).max(100).optional().nullable(),
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  }),
});

export const getPerformanceReviewsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    employeeId: z.string().uuid().optional(),
    reviewerId: z.string().uuid().optional(),
    reviewPeriod: z.string().optional(),
    reviewType: z.enum(["QUARTERLY", "ANNUAL", "PROBATION", "SPECIAL"]).optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
    search: z.string().trim().optional(),
    sortBy: z.enum(["createdAt", "reviewDate", "overallScore"]).default("reviewDate"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export const performanceReviewIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid performance review ID"),
  }),
});

export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>["body"];
export type UpdatePerformanceReviewInput = z.infer<typeof updatePerformanceReviewSchema>["body"];
export type GetPerformanceReviewsQueryInput = z.infer<typeof getPerformanceReviewsQuerySchema>["query"];
