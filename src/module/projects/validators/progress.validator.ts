import { z } from "zod";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// PROGRESS ENUMS VALIDATORS
// ==========================================

export const ProgressVisibilityEnum = z.enum(["INTERNAL", "CLIENT_VISIBLE"]);

export const ProgressApprovalStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUESTED",
]);

// ==========================================
// PARAMS & MAIN SCHEMAS
// ==========================================

export const progressProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const progressIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid progress ID format"),
  }),
});

export const createProgressSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    areaRoom: z.string().max(100).optional().nullable(),
    workStage: z.string().max(100).optional().nullable(),
    progressDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid progressDate format",
    }),
    progressPercent: z.number().min(0).max(100).default(0).optional(),
    description: z.string().max(5000).optional().nullable(),
    workCompleted: z.string().max(5000).optional().nullable(),
    workPending: z.string().max(5000).optional().nullable(),
    issues: z.string().max(5000).optional().nullable(),
    nextAction: z.string().max(5000).optional().nullable(),
    media: z.array(imageTypeSchema).default([]).optional().nullable(),
    visibility: ProgressVisibilityEnum.default("INTERNAL").optional(),
    approvalStatus: ProgressApprovalStatusEnum.default("SUBMITTED").optional(),
    submittedById: z.string().uuid("Invalid submittedById format").optional().nullable(),
  }),
});

export const updateProgressSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid progress ID format"),
  }),
  body: z.object({
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    areaRoom: z.string().max(100).optional().nullable(),
    workStage: z.string().max(100).optional().nullable(),
    progressDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid progressDate format" })
      .optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    description: z.string().max(5000).optional().nullable(),
    workCompleted: z.string().max(5000).optional().nullable(),
    workPending: z.string().max(5000).optional().nullable(),
    issues: z.string().max(5000).optional().nullable(),
    nextAction: z.string().max(5000).optional().nullable(),
    media: z.array(imageTypeSchema).optional().nullable(),
    visibility: ProgressVisibilityEnum.optional(),
    submittedById: z.string().uuid("Invalid submittedById format").optional().nullable(),
  }),
});

export const reviewProgressSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid progress ID format"),
  }),
  body: z.object({
    approvalStatus: z.enum(["APPROVED", "REJECTED", "REVISION_REQUESTED"]),
    rejectionReason: z.string().max(2000).optional().nullable(),
  }),
});

export const getProgressQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    milestoneId: z.string().uuid().optional(),
    areaRoom: z.string().max(100).optional(),
    workStage: z.string().max(100).optional(),
    approvalStatus: ProgressApprovalStatusEnum.optional(),
    visibility: ProgressVisibilityEnum.optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid startDate format" })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid endDate format" })
      .optional(),
    submittedById: z.string().uuid().optional(),
    sortBy: z.enum(["progressDate", "createdAt", "progressPercent"]).default("progressDate").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
});

// ==========================================
// TYPE INFERENCES
// ==========================================

export type CreateProgressInput = z.infer<typeof createProgressSchema>["body"];
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>["body"];
export type ReviewProgressInput = z.infer<typeof reviewProgressSchema>["body"];
export type GetProgressQueryInput = z.infer<typeof getProgressQuerySchema>["query"];
