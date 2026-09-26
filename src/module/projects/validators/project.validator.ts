import { z } from "zod";
import {
  ProjectType,
  ProjectStatus,
  ProjectDesignStatus,
  ProjectExecutionStatus,
  ProjectHealth,
  ProjectStage,
  StageStatus,
  ProjectPriority,
  ProjectMemberRole,
} from "../../../types/types";

// ==========================================
// ENUMS VALIDATORS (DIRECTLY FROM PRISMA CLIENT)
// ==========================================

export const ProjectTypeEnum = z.nativeEnum(ProjectType);
export const ProjectStatusEnum = z.nativeEnum(ProjectStatus);
export const ProjectDesignStatusEnum = z.nativeEnum(ProjectDesignStatus);
export const ProjectExecutionStatusEnum = z.nativeEnum(ProjectExecutionStatus);
export const ProjectHealthEnum = z.nativeEnum(ProjectHealth);
export const ProjectStageEnum = z.nativeEnum(ProjectStage);
export const StageStatusEnum = z.nativeEnum(StageStatus);
export const ProjectPriorityEnum = z.nativeEnum(ProjectPriority);
export const ProjectMemberRoleEnum = z.nativeEnum(ProjectMemberRole);

// ==========================================
// SUB-MODEL INPUT SCHEMAS
// ==========================================

export const projectSiteInputSchema = z.object({
  siteName: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(50).default("IN").optional(),
  pincode: z.string().max(20).optional().nullable(),
  gpsLat: z.number().min(-90).max(90).optional().nullable(),
  gpsLng: z.number().min(-180).max(180).optional().nullable(),
  propertyType: z.string().max(100).optional().nullable(),
  floorNumber: z.string().max(50).optional().nullable(),
  totalAreaSqft: z.number().nonnegative().optional().nullable(),
  workableAreaSqft: z.number().nonnegative().optional().nullable(),
  carpetAreaSqft: z.number().nonnegative().optional().nullable(),
  contactPerson: z.string().max(100).optional().nullable(),
  contactPersonRelation: z.string().max(100).optional().nullable(),
  contactPhone: z.string().max(20).optional().nullable(),
  contactEmail: z.string().email("Invalid contact email").optional().nullable().or(z.literal("")),
  accessInstructions: z.string().max(2000).optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const projectScheduleInputSchema = z.object({
  plannedStartDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid plannedStartDate format",
  }),
  plannedEndDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid plannedEndDate format",
  }),
  actualStartDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid actualStartDate format",
    })
    .optional()
    .nullable(),
  actualEndDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid actualEndDate format",
    })
    .optional()
    .nullable(),
  kickoffDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid kickoffDate format",
    })
    .optional()
    .nullable(),
  siteHandoverDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid siteHandoverDate format",
    })
    .optional()
    .nullable(),
  warrantyStartDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid warrantyStartDate format",
    })
    .optional()
    .nullable(),
  warrantyEndDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid warrantyEndDate format",
    })
    .optional()
    .nullable(),
  extendedWarrantyEndDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid extendedWarrantyEndDate format",
    })
    .optional()
    .nullable(),
  estimatedDurationDays: z.number().int().nonnegative().optional().nullable(),
  actualDurationDays: z.number().int().nonnegative().optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const projectMetricInputSchema = z.object({
  progressPercent: z.number().min(0).max(100).default(0).optional(),
  designProgress: z.number().min(0).max(100).default(0).optional(),
  executionProgress: z.number().min(0).max(100).default(0).optional(),
  procurementProgress: z.number().min(0).max(100).default(0).optional(),
  paymentProgress: z.number().min(0).max(100).default(0).optional(),
  qualityScore: z.number().min(0).max(100).optional().nullable(),
  safetyScore: z.number().min(0).max(100).optional().nullable(),
  lastEvaluatedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid lastEvaluatedAt format",
    })
    .optional()
    .nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const projectCommercialInputSchema = z.object({
  currency: z.string().max(10).default("INR").optional(),
  contractAmount: z.number().nonnegative().default(0).optional(),
  designFee: z.number().nonnegative().default(0).optional(),
  materialPayment: z.number().nonnegative().default(0).optional(),
  labourPayment: z.number().nonnegative().default(0).optional(),
  supervisionFee: z.number().nonnegative().default(0).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const projectMemberInputSchema = z.object({
  id: z.string().uuid("Invalid member ID format").optional(),
  employeeId: z.string().uuid("Invalid employee ID format"),
  role: ProjectMemberRoleEnum.default("OTHER"),
  customRoleTitle: z.string().max(100).optional().nullable(),
  responsibilities: z.string().max(2000).optional().nullable(),
  isPrimary: z.boolean().default(false).optional(),
  isActive: z.boolean().default(true).optional(),
  allocatedHoursPerWeek: z.number().nonnegative().max(168).optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const projectClientDetailsInputSchema = z.object({
  alternatePhone: z.string().max(20).optional().nullable(),
  alternateContactRelation: z.string().max(100).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  aadhaarNumber: z.string().max(20).optional().nullable(),
});

// ImageType JSON Schema for coverImageUrl
export const imageTypeSchema = z.object({
  id: z.string(),
  url: z.string().url("Invalid image URL"),
  bytes: z.number().nonnegative(),
  format: z.string(),
  provider: z.string(),
});

// ==========================================
// PARAMS & MAIN API SCHEMAS
// ==========================================

export const projectIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
});

export const createProjectSchema = z.object({
  body: z.object({
    // Core Links & Identity
    customerId: z.string().uuid("Invalid customer ID format"),
    leadId: z.string().uuid("Invalid lead ID format").optional().nullable(),
    projectCode: z.string().max(50).optional().nullable(), // If omitted, auto-generated PRJ-YYYY-NNNN
    // Service Category Master Link
    serviceCategoryId: z.string().uuid("Invalid service category ID format").optional().nullable(),
    name: z.string().min(1, "Project name is required").max(200),
    description: z.string().max(5000).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    type: ProjectTypeEnum.default("TURNKEY").optional(),
    status: ProjectStatusEnum.default("PLANNED").optional(),
    designStatus: ProjectDesignStatusEnum.default("NOT_STARTED").optional(),
    executionStatus: ProjectExecutionStatusEnum.default("NOT_STARTED").optional(),
    health: ProjectHealthEnum.default("HEALTHY").optional(),
    currentStage: ProjectStageEnum.default("ONBOARDING").optional(),
    activeStages: z.array(ProjectStageEnum).default(["ONBOARDING"]).optional(),
    stageStatuses: z.record(z.string(), z.any()).optional().nullable(),
    priority: ProjectPriorityEnum.default("MEDIUM").optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),

    // Client Contact & KYC Details Update
    client: projectClientDetailsInputSchema.optional().nullable(),
    clientAlternatePhone: z.string().max(20).optional().nullable(),
    clientAlternateRelation: z.string().max(100).optional().nullable(),
    clientPan: z.string().max(20).optional().nullable(),
    clientAadhaar: z.string().max(20).optional().nullable(),

    // Client Portal & Satisfaction
    isClientPortalVisible: z.boolean().default(true).optional(),
    clientRating: z.number().min(0).max(10).optional().nullable(),
    clientFeedback: z.string().max(5000).optional().nullable(),

    // Metadata
    tags: z.array(z.string().max(50)).default([]).optional(),
    notes: z.string().max(5000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),

    // Optional Segregated Child Tables
    site: projectSiteInputSchema.optional().nullable(),
    schedule: projectScheduleInputSchema.optional().nullable(),
    metric: projectMetricInputSchema.optional().nullable(),
    commercial: projectCommercialInputSchema.optional().nullable(),
    members: z.array(projectMemberInputSchema).default([]).optional(),
  }),
});

export const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project ID format"),
  }),
  body: z.object({
    // Core Links & Identity
    customerId: z.string().uuid("Invalid customer ID format").optional(),
    leadId: z.string().uuid("Invalid lead ID format").optional().nullable(),
    serviceCategoryId: z.string().uuid("Invalid service category ID format").optional().nullable(),
    projectCode: z.string().max(50).optional(),
    name: z.string().min(1, "Project name is required").max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    category: z.string().max(100).optional().nullable(),
    type: ProjectTypeEnum.optional(),
    status: ProjectStatusEnum.optional(),
    designStatus: ProjectDesignStatusEnum.optional(),
    executionStatus: ProjectExecutionStatusEnum.optional(),
    health: ProjectHealthEnum.optional(),
    currentStage: ProjectStageEnum.optional(),
    activeStages: z.array(ProjectStageEnum).optional(),
    stageStatuses: z.record(z.string(), z.any()).optional().nullable(),
    priority: ProjectPriorityEnum.optional(),
    coverImageUrl: imageTypeSchema.optional().nullable(),

    // Client Contact & KYC Details Update
    client: projectClientDetailsInputSchema.partial().optional().nullable(),
    clientAlternatePhone: z.string().max(20).optional().nullable(),
    clientAlternateRelation: z.string().max(100).optional().nullable(),
    clientPan: z.string().max(20).optional().nullable(),
    clientAadhaar: z.string().max(20).optional().nullable(),

    // Client Portal & Satisfaction
    isClientPortalVisible: z.boolean().optional(),
    clientRating: z.number().min(0).max(10).optional().nullable(),
    clientFeedback: z.string().max(5000).optional().nullable(),

    // Metadata
    tags: z.array(z.string().max(50)).optional(),
    notes: z.string().max(5000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),

    // Segregated Child Tables (Partial / Nested update)
    site: projectSiteInputSchema.partial().optional().nullable(),
    schedule: projectScheduleInputSchema.partial().optional().nullable(),
    metric: projectMetricInputSchema.partial().optional().nullable(),
    commercial: projectCommercialInputSchema.partial().optional().nullable(),
    members: z.array(projectMemberInputSchema).optional(),
  }),
});

export const getProjectsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    search: z.string().max(100).optional(),
    status: ProjectStatusEnum.optional(),
    designStatus: ProjectDesignStatusEnum.optional(),
    executionStatus: ProjectExecutionStatusEnum.optional(),
    health: ProjectHealthEnum.optional(),
    currentStage: ProjectStageEnum.optional(),
    priority: ProjectPriorityEnum.optional(),
    type: ProjectTypeEnum.optional(),
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    sortBy: z.enum(["createdAt", "updatedAt", "name", "projectCode", "status", "health", "priority"]).default("createdAt").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
});

// ==========================================
// TYPE INFERENCES
// ==========================================

export type CreateProjectInput = z.infer<typeof createProjectSchema>["body"];
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>["body"];
export type GetProjectsQueryInput = z.infer<typeof getProjectsQuerySchema>["query"];
export type ProjectSiteInput = z.infer<typeof projectSiteInputSchema>;
export type ProjectScheduleInput = z.infer<typeof projectScheduleInputSchema>;
export type ProjectMetricInput = z.infer<typeof projectMetricInputSchema>;
export type ProjectCommercialInput = z.infer<typeof projectCommercialInputSchema>;
export type ProjectMemberInput = z.infer<typeof projectMemberInputSchema>;
