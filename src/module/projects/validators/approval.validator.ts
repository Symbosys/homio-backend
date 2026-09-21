import { z } from "zod";
import { ProjectPriorityEnum, imageTypeSchema } from "./project.validator.js";

// ==========================================
// WORK APPROVAL ENUMS
// ==========================================

export const ApprovalTypeEnum = z.enum([
  "DESIGN",
  "MATERIAL",
  "EXECUTION_STAGE",
  "WORK_COMPLETION",
  "PAYMENT",
  "FINAL_HANDOVER",
  "OTHER",
]);

export const ApprovalStatusEnum = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REVISION_REQUESTED",
  "RESUBMITTED",
]);

export const ChangeRequestStatusEnum = z.enum([
  "PENDING",
  "IN_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "IMPLEMENTED",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const approvalProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const approvalIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid approval ID format"),
  }),
});

export const changeRequestIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    approvalId: z.string().uuid("Invalid approval ID format"),
    id: z.string().uuid("Invalid change request ID format"),
  }),
});

export const approvalChangeRequestsParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    approvalId: z.string().uuid("Invalid approval ID format"),
  }),
});

// ==========================================
// WORK APPROVAL BODY SCHEMAS
// ==========================================

export const createApprovalSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    title: z.string().min(1, "Title is required").max(250),
    description: z.string().max(5000).optional().nullable(),
    type: ApprovalTypeEnum.default("DESIGN").optional(),
    status: ApprovalStatusEnum.default("PENDING").optional(),
    priority: ProjectPriorityEnum.default("MEDIUM").optional(),

    submittedById: z.string().uuid("Invalid submitter ID format").optional().nullable(),
    dueDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid dueDate format" })
      .optional()
      .nullable(),

    attachments: z.array(imageTypeSchema).optional().nullable(),
    isClientPortalVisible: z.boolean().default(true).optional(),
  }),
});

export const updateApprovalSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid approval ID format"),
  }),
  body: z.object({
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    title: z.string().min(1, "Title is required").max(250).optional(),
    description: z.string().max(5000).optional().nullable(),
    type: ApprovalTypeEnum.optional(),
    status: ApprovalStatusEnum.optional(),
    priority: ProjectPriorityEnum.optional(),

    submittedById: z.string().uuid("Invalid submitter ID format").optional().nullable(),
    dueDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid dueDate format" })
      .optional()
      .nullable(),

    attachments: z.array(imageTypeSchema).optional().nullable(),
    isClientPortalVisible: z.boolean().optional(),
  }),
});

export const reviewApprovalSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid approval ID format"),
  }),
  body: z.object({
    action: z.enum(["APPROVE", "REJECT"], {
      message: "Action must be either APPROVE or REJECT",
    }),
    clientFeedback: z.string().max(5000).optional().nullable(),
    rejectionReason: z.string().max(5000).optional().nullable(),
  }),
});

export const getApprovalsQuerySchema = z.object({
  query: z.object({
    status: ApprovalStatusEnum.optional(),
    type: ApprovalTypeEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    milestoneId: z.string().uuid().optional(),
    submittedById: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    sortBy: z.enum(["createdAt", "dueDate", "reviewedAt", "title"]).default("createdAt").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
});

// ==========================================
// CHANGE REQUEST BODY SCHEMAS
// ==========================================

export const createChangeRequestSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    approvalId: z.string().uuid("Invalid approval ID format"),
  }),
  body: z.object({
    title: z.string().max(250).optional().nullable(),
    requestedChanges: z.string().min(1, "Requested changes description is required").max(5000),
    reason: z.string().max(2000).optional().nullable(),
    requestedByCustomerId: z.string().uuid("Invalid customer ID format").optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

export const respondChangeRequestSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    approvalId: z.string().uuid("Invalid approval ID format"),
    id: z.string().uuid("Invalid change request ID format"),
  }),
  body: z.object({
    status: ChangeRequestStatusEnum,
    responseNotes: z.string().max(5000).optional().nullable(),
    respondedById: z.string().uuid("Invalid responder ID format").optional().nullable(),
    revisedAttachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

// ==========================================
// TYPE INFERENCES
// ==========================================

export type CreateApprovalInput = z.infer<typeof createApprovalSchema>["body"];
export type UpdateApprovalInput = z.infer<typeof updateApprovalSchema>["body"];
export type ReviewApprovalInput = z.infer<typeof reviewApprovalSchema>["body"];
export type GetApprovalsQueryInput = z.infer<typeof getApprovalsQuerySchema>["query"];
export type CreateChangeRequestInput = z.infer<typeof createChangeRequestSchema>["body"];
export type RespondChangeRequestInput = z.infer<typeof respondChangeRequestSchema>["body"];
