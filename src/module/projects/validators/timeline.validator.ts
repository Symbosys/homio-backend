import { z } from "zod";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// TIMELINE ENUMS VALIDATORS
// ==========================================

export const ProjectTimelineEventTypeEnum = z.enum([
  "PROJECT_CREATED",
  "STAGE_CHANGED",
  "STATUS_CHANGED",
  "HEALTH_CHANGED",
  "SITE_VISIT",
  "MILESTONE_STARTED",
  "MILESTONE_COMPLETED",
  "WORK_APPROVAL",
  "PROGRESS_UPDATE",
  "COMMERCIAL_INVOICE",
  "HANDOVER_SNAG",
  "CUSTOM_EVENT",
  "OTHER",
]);

export const ProjectTimelineStatusEnum = z.enum([
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "DELAYED",
  "CANCELLED",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const timelineProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const timelineIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    id: z.string().uuid("Invalid timeline ID format"),
  }),
});

// ==========================================
// BODY & QUERY SCHEMAS
// ==========================================

export const createTimelineSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    title: z.string().min(1, "Timeline event title is required").max(200),
    description: z.string().max(5000).optional().nullable(),
    eventType: ProjectTimelineEventTypeEnum.default("CUSTOM_EVENT").optional(),
    category: z.string().max(100).optional().nullable(),
    status: ProjectTimelineStatusEnum.default("COMPLETED").optional(),
    eventDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid eventDate format",
      })
      .default(() => new Date().toISOString())
      .optional(),
    orderIndex: z.number().int().default(0).optional(),
    performedById: z.string().uuid("Invalid employee ID format").optional().nullable(),
    isCustom: z.boolean().default(true).optional(),
    isSystemGenerated: z.boolean().default(false).optional(),
    attachments: z.array(imageTypeSchema).optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTimelineSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    id: z.string().uuid("Invalid timeline ID format"),
  }),
  body: z.object({
    title: z.string().min(1, "Timeline event title is required").max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    eventType: ProjectTimelineEventTypeEnum.optional(),
    category: z.string().max(100).optional().nullable(),
    status: ProjectTimelineStatusEnum.optional(),
    eventDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid eventDate format",
      })
      .optional(),
    orderIndex: z.number().int().optional(),
    performedById: z.string().uuid("Invalid employee ID format").optional().nullable(),
    isCustom: z.boolean().optional(),
    attachments: z.array(imageTypeSchema).optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const getTimelinesQuerySchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    search: z.string().max(100).optional(),
    eventType: ProjectTimelineEventTypeEnum.optional(),
    category: z.string().max(100).optional(),
    status: ProjectTimelineStatusEnum.optional(),
    isCustom: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    sortBy: z.enum(["eventDate", "orderIndex", "createdAt"]).default("eventDate").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
  }),
});

export type CreateTimelineInput = z.infer<typeof createTimelineSchema>["body"];
export type UpdateTimelineInput = z.infer<typeof updateTimelineSchema>["body"];
export type GetTimelinesQuery = z.infer<typeof getTimelinesQuerySchema>["query"];
