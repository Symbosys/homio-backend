import { z } from "zod";
import { PayrollStatus, IncentiveType, IncentiveStatus } from "../../../types/types.js";

/**
 * Native Zod Enums synced with Prisma Schema (Rule 22)
 */
export const PayrollStatusEnum = z.nativeEnum(PayrollStatus);
export const IncentiveTypeEnum = z.nativeEnum(IncentiveType);
export const IncentiveStatusEnum = z.nativeEnum(IncentiveStatus);

export const ReportDatePresetEnum = z.enum([
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "this_year",
  "all_time",
  "custom",
]);

/**
 * Query schema for HRMS overview summary report (Payroll + Incentives + Attendance)
 */
export const getHrmsReportQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    payrollPeriodId: z.string().uuid("Invalid payroll period ID format").optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    preset: ReportDatePresetEnum.optional(),
    status: PayrollStatusEnum.optional(),
  }),
});

/**
 * Query schema for employee incentives analytics
 */
export const getHrmsIncentivesReportQuerySchema = z.object({
  query: z.object({
    employeeId: z.string().uuid("Invalid employee ID format").optional(),
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    type: IncentiveTypeEnum.optional(),
    status: IncentiveStatusEnum.optional(),
    preset: ReportDatePresetEnum.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10).optional(),
  }),
});

export type GetHrmsReportQueryInput = z.infer<typeof getHrmsReportQuerySchema>["query"];
export type GetHrmsIncentivesReportQueryInput = z.infer<typeof getHrmsIncentivesReportQuerySchema>["query"];
