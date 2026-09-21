import { z } from "zod";
import { imageTypeSchema } from "./project.validator.js";

// ==========================================
// SITE VISIT ENUMS
// ==========================================

export const SiteVisitTypeEnum = z.enum([
  "MEASUREMENT",
  "DESIGN",
  "EXECUTION",
  "INSPECTION",
  "SUPERVISOR",
  "CLIENT",
  "MATERIAL_INSPECTION",
  "FINAL_INSPECTION",
  "OTHER",
]);

export const SiteVisitStatusEnum = z.enum([
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
]);

export const SiteVisitOutcomeEnum = z.enum([
  "COMPLETED",
  "ISSUES_FOUND",
  "FOLLOW_UP_REQUIRED",
  "PENDING_APPROVAL",
]);

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const siteVisitProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

export const siteVisitIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    id: z.string().uuid("Invalid site visit ID format"),
  }),
});

// ==========================================
// BODY SCHEMAS
// ==========================================

export const createSiteVisitSchema = z.object({
  params: z
    .object({
      projectId: z.string().uuid("Invalid project ID format").optional(),
    })
    .optional(),
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(255).default("Site Inspection Visit"),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    visitType: SiteVisitTypeEnum.default("EXECUTION"),
    status: SiteVisitStatusEnum.default("SCHEDULED"),
    outcome: SiteVisitOutcomeEnum.optional().nullable(),

    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Planned date must be YYYY-MM-DD format"),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),

    actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Actual date must be YYYY-MM-DD format").optional().nullable(),

    purpose: z.string().max(2000).optional().nullable(),
    summary: z.string().max(5000).optional().nullable(),
    issuesIdentified: z.string().max(5000).optional().nullable(),
    actionItems: z.string().max(5000).optional().nullable(),

    visitorEmployeeId: z.string().uuid("Invalid visitor employee ID format").optional().nullable(),
    clientRepresentative: z.string().max(255).optional().nullable(),
    locationGpsLat: z.number().min(-90).max(90).optional().nullable(),
    locationGpsLng: z.number().min(-180).max(180).optional().nullable(),

    isClientPortalVisible: z.boolean().default(true),
    attachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

export const updateSiteVisitSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    id: z.string().uuid("Invalid site visit ID format"),
  }),
  body: z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(255).optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional().nullable(),
    visitType: SiteVisitTypeEnum.optional(),
    status: SiteVisitStatusEnum.optional(),
    outcome: SiteVisitOutcomeEnum.optional().nullable(),

    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Planned date must be YYYY-MM-DD format").optional(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),

    actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Actual date must be YYYY-MM-DD format").optional().nullable(),

    purpose: z.string().max(2000).optional().nullable(),
    summary: z.string().max(5000).optional().nullable(),
    issuesIdentified: z.string().max(5000).optional().nullable(),
    actionItems: z.string().max(5000).optional().nullable(),

    visitorEmployeeId: z.string().uuid("Invalid visitor employee ID format").optional().nullable(),
    clientRepresentative: z.string().max(255).optional().nullable(),
    locationGpsLat: z.number().min(-90).max(90).optional().nullable(),
    locationGpsLng: z.number().min(-180).max(180).optional().nullable(),

    isClientPortalVisible: z.boolean().optional(),
    attachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

export const completeSiteVisitSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    id: z.string().uuid("Invalid site visit ID format"),
  }),
  body: z.object({
    actualDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Actual date must be YYYY-MM-DD format").optional(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
    outcome: SiteVisitOutcomeEnum.default("COMPLETED"),
    summary: z.string().max(5000).optional().nullable(),
    issuesIdentified: z.string().max(5000).optional().nullable(),
    actionItems: z.string().max(5000).optional().nullable(),
    attachments: z.array(imageTypeSchema).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMA
// ==========================================

export const getSiteVisitsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    projectId: z.string().uuid("Invalid project ID format").optional(),
    milestoneId: z.string().uuid("Invalid milestone ID format").optional(),
    visitorEmployeeId: z.string().uuid("Invalid employee ID format").optional(),
    visitType: SiteVisitTypeEnum.optional(),
    status: SiteVisitStatusEnum.optional(),
    outcome: SiteVisitOutcomeEnum.optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  }),
});

export type CreateSiteVisitInput = z.infer<typeof createSiteVisitSchema>["body"];
export type UpdateSiteVisitInput = z.infer<typeof updateSiteVisitSchema>["body"];
export type CompleteSiteVisitInput = z.infer<typeof completeSiteVisitSchema>["body"];
export type GetSiteVisitsQuery = z.infer<typeof getSiteVisitsQuerySchema>["query"];
