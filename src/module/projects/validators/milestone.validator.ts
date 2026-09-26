import { z } from "zod";
import {
  ProjectStageEnum,
  ProjectPriorityEnum,
  imageTypeSchema,
} from "./project.validator.js";

// ==========================================
// MILESTONE ENUMS VALIDATORS
// ==========================================

export const MilestoneTypeEnum = z.enum([
  "DESIGN",
  "EXECUTION",
]);

export const MilestoneStatusEnum = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PENDING_APPROVAL",
  "COMPLETED",
  "DELAYED",
  "BLOCKED",
  "CANCELLED",
]);

// ==========================================
// CHECKLIST INPUT SCHEMAS
// ==========================================

export const milestoneChecklistItemInputSchema = z.object({
  id: z.string().uuid("Invalid checklist ID format").optional(),
  title: z.string().min(1, "Checklist title is required").max(200),
  isCompleted: z.boolean().default(false).optional(),
  completedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid completedAt format",
    })
    .optional()
    .nullable(),
  orderIndex: z.number().int().nonnegative().default(0).optional(),
  dueDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid dueDate format",
    })
    .optional()
    .nullable(),
  assigneeId: z
    .string()
    .uuid("Invalid assignee ID format")
    .optional()
    .nullable(),
});

// ==========================================
// PARAMS & MAIN SCHEMAS
// ==========================================

export const milestoneProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const milestoneIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid milestone ID format"),
  }),
});

export const toggleChecklistParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    milestoneId: z.string().uuid("Invalid milestone ID format"),
    checklistId: z.string().uuid("Invalid checklist ID format"),
  }),
  body: z
    .object({
      isCompleted: z.boolean().optional(),
    })
    .optional(),
});

export const createMilestoneSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    milestoneCode: z.string().max(50).optional().nullable(), // If omitted, auto MS-01, MS-02
    milestoneType: MilestoneTypeEnum.default("EXECUTION").optional(),
    name: z.string().min(1, "Milestone name is required").max(200),
    description: z.string().max(5000).optional().nullable(),
    stage: ProjectStageEnum.default("EXECUTION").optional(),
    status: MilestoneStatusEnum.default("NOT_STARTED").optional(),
    priority: ProjectPriorityEnum.default("MEDIUM").optional(),
    orderIndex: z.number().int().nonnegative().default(0).optional(),

    // Timeline
    startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid startDate format",
    }),
    dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid dueDate format",
    }),
    actualStartDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid actualStartDate format",
      })
      .optional()
      .nullable(),
    completedAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid completedAt format",
      })
      .optional()
      .nullable(),
    completionPercent: z.number().min(0).max(100).default(0).optional(),

    // Ownership & Gates
    assigneeId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),
    approvalRequired: z.boolean().default(false).optional(),
    paymentRequired: z.boolean().default(false).optional(),
    budgetAmount: z.number().nonnegative().optional().nullable(),

    // Cloud Attachments (Array of ImageType)
    attachments: z.array(imageTypeSchema).optional().nullable(),

    // Optional Nested Checklists
    checklists: z
      .array(milestoneChecklistItemInputSchema)
      .default([])
      .optional(),
  }),
});

export const updateMilestoneSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid milestone ID format"),
  }),
  body: z.object({
    milestoneCode: z.string().max(50).optional(),
    milestoneType: MilestoneTypeEnum.optional(),
    name: z.string().min(1, "Milestone name is required").max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    stage: ProjectStageEnum.optional(),
    status: MilestoneStatusEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    orderIndex: z.number().int().nonnegative().optional(),

    // Timeline
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startDate format",
      })
      .optional(),
    dueDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid dueDate format",
      })
      .optional(),
    actualStartDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid actualStartDate format",
      })
      .optional()
      .nullable(),
    completedAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid completedAt format",
      })
      .optional()
      .nullable(),
    completionPercent: z.number().min(0).max(100).optional(),

    // Ownership & Gates
    assigneeId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),
    approvalRequired: z.boolean().optional(),
    paymentRequired: z.boolean().optional(),
    budgetAmount: z.number().nonnegative().optional().nullable(),

    // Cloud Attachments
    attachments: z.array(imageTypeSchema).optional().nullable(),

    // Nested Checklists replacement/sync
    checklists: z.array(milestoneChecklistItemInputSchema).optional(),
  }),
});

export const getMilestonesQuerySchema = z.object({
  query: z.object({
    stage: ProjectStageEnum.optional(),
    status: MilestoneStatusEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    milestoneType: MilestoneTypeEnum.optional(),
    assigneeId: z.string().uuid().optional(),
    sortBy: z
      .enum([
        "orderIndex",
        "startDate",
        "dueDate",
        "completionPercent",
        "createdAt",
      ])
      .default("orderIndex")
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
  }),
});

// ==========================================
// TYPE INFERENCES
// ==========================================

export type CreateMilestoneInput = z.infer<
  typeof createMilestoneSchema
>["body"];
export type UpdateMilestoneInput = z.infer<
  typeof updateMilestoneSchema
>["body"];
export type GetMilestonesQueryInput = z.infer<
  typeof getMilestonesQuerySchema
>["query"];
export type MilestoneChecklistItemInput = z.infer<
  typeof milestoneChecklistItemInputSchema
>;
