import { z } from "zod";
import { LeadStatus, LeadSource, LeadPriority, LeadProjectType } from "../../../types/types.js";

/**
 * Native Zod Enums synced with Prisma Schema (Rule 22)
 */
export const LeadStatusEnum = z.nativeEnum(LeadStatus);
export const LeadSourceEnum = z.nativeEnum(LeadSource);
export const LeadPriorityEnum = z.nativeEnum(LeadPriority);
export const LeadProjectTypeEnum = z.nativeEnum(LeadProjectType);

export const TimeGroupingEnum = z.enum(["day", "week", "month", "year"]);
export const TopPerformerMetricEnum = z.enum(["conversions", "conversion_rate", "revenue", "leads_handled"]);

/**
 * Validator schema for employee lead performance report
 */
export const getEmployeePerformanceQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    groupBy: TimeGroupingEnum.default("month").optional(),
    status: LeadStatusEnum.optional(),
    source: LeadSourceEnum.optional(),
    projectType: LeadProjectTypeEnum.optional(),
    priority: LeadPriorityEnum.optional(),
  }),
});

/**
 * Validator schema for top performing sales/conversion employees
 */
export const getTopPerformersQuerySchema = z.object({
  query: z.object({
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
    metric: TopPerformerMetricEnum.default("conversions").optional(),
  }),
});

export type GetEmployeePerformanceQueryInput = z.infer<typeof getEmployeePerformanceQuerySchema>["query"];
export type GetTopPerformersQueryInput = z.infer<typeof getTopPerformersQuerySchema>["query"];
