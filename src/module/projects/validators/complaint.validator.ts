import { z } from "zod";
import {
  ComplaintType,
  ComplaintStatus,
  ComplaintSeverity,
} from "../../../types/types.js";
import { ProjectPriorityEnum, imageTypeSchema } from "./project.validator.js";

// ==========================================
// COMPLAINT ENUMS (Rule 22: z.nativeEnum)
// ==========================================

export const ComplaintTypeEnum = z.nativeEnum(ComplaintType);
export const ComplaintStatusEnum = z.nativeEnum(ComplaintStatus);
export const ComplaintSeverityEnum = z.nativeEnum(ComplaintSeverity);

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
    type: ComplaintTypeEnum.default(ComplaintType.QUALITY).optional(),
    status: ComplaintStatusEnum.default(ComplaintStatus.OPEN).optional(),
    severity: ComplaintSeverityEnum.default(ComplaintSeverity.MEDIUM).optional(),
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
    serviceRequestId: z
      .string()
      .uuid("Invalid service request ID format")
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
    status: ComplaintStatusEnum.optional(),
    severity: ComplaintSeverityEnum.optional(),
    priority: ProjectPriorityEnum.optional(),

    areaRoom: z.string().max(100).optional().nullable(),

    assignedToId: z
      .string()
      .uuid("Invalid assignee ID format")
      .optional()
      .nullable(),
    serviceRequestId: z
      .string()
      .uuid("Invalid service request ID format")
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
    serviceRequestId: z.string().uuid().optional(),
    phase: z.enum(["ONGOING", "AFTER_SALES", "ALL"]).optional(),
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

// ==========================================
// SEPARATE ORGANIZATION-WIDE COMPLAINT SCHEMAS
// ==========================================

export const getOrgComplaintsQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    status: ComplaintStatusEnum.optional(),
    type: ComplaintTypeEnum.optional(),
    severity: ComplaintSeverityEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    milestoneId: z.string().uuid().optional(),
    serviceRequestId: z.string().uuid().optional(),
    phase: z.enum(["ONGOING", "AFTER_SALES", "ALL"]).optional(),
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

export type GetOrgComplaintsQueryInput = z.infer<
  typeof getOrgComplaintsQuerySchema
>["query"];
