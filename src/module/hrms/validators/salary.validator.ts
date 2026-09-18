import { z } from "zod";

const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string(),
  bytes: z.number(),
  format: z.string(),
  provider: z.enum(["CLOUDINARY", "AWS_S3", "AZURE_BLOB", "LOCAL"]),
});

export const payFrequencyEnum = z.enum(["MONTHLY", "BIWEEKLY", "WEEKLY", "ANNUAL", "HOURLY"]);
export const salaryRevisionReasonEnum = z.enum([
  "NEW_HIRE",
  "ANNUAL_INCREMENT",
  "PROMOTION",
  "CONFIRMATION",
  "MARKET_CORRECTION",
  "SPECIAL_ALLOWANCE_REVISION",
  "DEMOTION",
  "TRANSFER",
  "OTHER",
]);

const customSalaryComponentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Component name is required"),
  type: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_CONTRIBUTION", "REIMBURSEMENT"]),
  amount: z.coerce.number().min(0),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]).default("MONTHLY"),
  isTaxable: z.boolean().default(true),
});

export const createSalaryStructureSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID"),
  }),
  body: z.object({
    effectiveFrom: z.string({ message: "effectiveFrom date is required" }),
    revisionReason: salaryRevisionReasonEnum.default("NEW_HIRE"),
    revisionDate: z.string().optional(),
    percentageHike: z.coerce.number().nullable().optional(),
    remarks: z.string().trim().nullable().optional(),
    incrementLetterUrl: z.union([z.string().trim().url(), imageTypeSchema]).nullable().optional(),

    currency: z.string().trim().length(3).default("INR"),
    payFrequency: payFrequencyEnum.default("MONTHLY"),

    // Key Aggregates
    annualCtc: z.coerce.number().min(0, "Annual CTC cannot be negative"),
    monthlyGross: z.coerce.number().min(0, "Monthly Gross cannot be negative"),
    monthlyNet: z.coerce.number().min(0).nullable().optional(),

    // Monthly Earnings Breakdown
    basicSalary: z.coerce.number().min(0, "Basic salary cannot be negative"),
    hra: z.coerce.number().min(0).default(0),
    dearnessAllowance: z.coerce.number().min(0).default(0),
    conveyanceAllowance: z.coerce.number().min(0).default(0),
    specialAllowance: z.coerce.number().min(0).default(0),
    medicalAllowance: z.coerce.number().min(0).default(0),
    otherAllowances: z.coerce.number().min(0).default(0),

    // Monthly Deductions Breakdown
    pfEmployee: z.coerce.number().min(0).default(0),
    esiEmployee: z.coerce.number().min(0).default(0),
    professionalTax: z.coerce.number().min(0).default(0),
    tdsMonthly: z.coerce.number().min(0).default(0),

    // Monthly Employer Contributions Breakdown (Part of CTC)
    pfEmployer: z.coerce.number().min(0).default(0),
    esiEmployer: z.coerce.number().min(0).default(0),
    gratuityMonthly: z.coerce.number().min(0).default(0),
    insuranceMonthly: z.coerce.number().min(0).default(0),

    // Extensible dynamic components
    customComponents: z.array(customSalaryComponentSchema).nullable().optional(),
  }),
});

export const updateSalaryStructureSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID"),
    salaryId: z.string().uuid("Invalid salary ID"),
  }),
  body: createSalaryStructureSchema.shape.body.partial(),
});

export const salaryIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid salary ID format"),
  }),
});

export const employeeSalaryHistoryParamSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid("Invalid employee ID format"),
  }),
});

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>["body"];
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>["body"];
