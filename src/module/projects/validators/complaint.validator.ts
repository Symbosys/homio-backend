import { z } from "zod";
import { ProjectPriorityEnum, imageTypeSchema } from "./project.validator.js";

// ==========================================
// COMPLAINT ENUMS
// ==========================================

export const ComplaintTypeEnum = z.enum([
  "DESIGN",
  "QUALITY",
  "MATERIAL",
  "EXECUTION",
  "TIMELINE",
  "BEHAVIOUR",
  "PAYMENT",
  "COMMUNICATION",
  "WARRANTY",
  "OTHER",
]);

export const ComplaintStatusEnum = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
  "REOPENED",
]);

export const ComplaintSeverityEnum = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const complaintProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const complaintIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid complaint ID format"),
  }),
});

export const complaintCommentsParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
  }),
});

// ==========================================
// COMPLAINT BODY SCHEMAS
// ==========================================

export const createComplaintSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    milestoneId: z
      .string()
      .uuid("Invalid milestone ID format")
      .optional()
      .nullable(),
    title: z.string().min(1, "Complaint title is required").max(250),
    description: z
      .string()
      .min(1, "Complaint description is required")
      .max(5000),
    type: ComplaintTypeEnum.default("QUALITY").optional(),
    categoryId: z.string().uuid("Invalid complaint category ID format").optional().nullable(),
    status: ComplaintStatusEnum.default("OPEN").optional(),
    severity: ComplaintSeverityEnum.default("MEDIUM").optional(),
    priority: ProjectPriorityEnum.default("MEDIUM").optional(),

    areaRoom: z.string().max(100).optional().nullable(),

    reportedByCustomerId: z
      .string()
      .uuid("Invalid customer ID format")
      .optional()
      .nullable(),
    reportedByEmployeeId: z
      .string()
      .uuid("Invalid employee ID format")
      .optional()
      .nullable(),
    assignedToId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),

    targetResolutionDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid targetResolutionDate format",
      })
      .optional()
      .nullable(),

    attachments: z.array(imageTypeSchema).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateComplaintSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    milestoneId: z
      .string()
      .uuid("Invalid milestone ID format")
      .optional()
      .nullable(),
    title: z.string().min(1, "Complaint title is required").max(250).optional(),
    description: z
      .string()
      .min(1, "Complaint description is required")
      .max(5000)
      .optional(),
    type: ComplaintTypeEnum.optional(),
    categoryId: z.string().uuid("Invalid complaint category ID format").optional().nullable(),
    status: ComplaintStatusEnum.optional(),
    severity: ComplaintSeverityEnum.optional(),
    priority: ProjectPriorityEnum.optional(),

    areaRoom: z.string().max(100).optional().nullable(),

    assignedToId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),

    targetResolutionDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid targetResolutionDate format",
      })
      .optional()
      .nullable(),

    attachments: z.array(imageTypeSchema).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateComplaintStatusSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    status: ComplaintStatusEnum,
    assignedToId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),
    resolvedById: z
      .string()
      .uuid("Invalid resolver ID format")
      .optional()
      .nullable(),
    resolutionNotes: z.string().max(5000).optional().nullable(),
    rejectionReason: z.string().max(5000).optional().nullable(),
  }),
});

export const addComplaintCommentSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    authorType: z.enum(["CUSTOMER", "EMPLOYEE"]).default("EMPLOYEE").optional(),
    employeeId: z
      .string()
      .uuid("Invalid employee ID format")
      .optional()
      .nullable(),
    userId: z.string().uuid("Invalid user ID format").optional().nullable(),
    message: z.string().min(1, "Comment message is required").max(5000),
    attachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

export const getComplaintsQuerySchema = z.object({
  query: z.object({
    status: ComplaintStatusEnum.optional(),
    type: ComplaintTypeEnum.optional(),
    severity: ComplaintSeverityEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    milestoneId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
    reportedByCustomerId: z.string().uuid().optional(),
    reportedByEmployeeId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    sortBy: z
      .enum([
        "createdAt",
        "targetResolutionDate",
        "resolvedAt",
        "priority",
        "severity",
      ])
      .default("createdAt")
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
});

// ==========================================
// TYPE INFERENCES
// ==========================================

export type CreateComplaintInput = z.infer<
  typeof createComplaintSchema
>["body"];
export type UpdateComplaintInput = z.infer<
  typeof updateComplaintSchema
>["body"];
export type UpdateComplaintStatusInput = z.infer<
  typeof updateComplaintStatusSchema
>["body"];
export type AddComplaintCommentInput = z.infer<
  typeof addComplaintCommentSchema
>["body"];
export type GetComplaintsQueryInput = z.infer<
  typeof getComplaintsQuerySchema
>["query"];
