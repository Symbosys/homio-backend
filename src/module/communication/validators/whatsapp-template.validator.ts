import { z } from "zod";
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppHeaderType,
  WhatsAppButtonType,
  CrmMappingEntity,
  WhatsAppVariableComponent,
} from "../../../types/types.js";

// ==========================================
// ZOD NATIVE ENUMS (Rule 22 Standard)
// ==========================================
export const WhatsAppTemplateCategoryEnum = z.nativeEnum(WhatsAppTemplateCategory);
export const WhatsAppTemplateStatusEnum = z.nativeEnum(WhatsAppTemplateStatus);
export const WhatsAppHeaderTypeEnum = z.nativeEnum(WhatsAppHeaderType);
export const WhatsAppButtonTypeEnum = z.nativeEnum(WhatsAppButtonType);
export const CrmMappingEntityEnum = z.nativeEnum(CrmMappingEntity);
export const WhatsAppVariableComponentEnum = z.nativeEnum(WhatsAppVariableComponent);

// ==========================================
// BUTTON SCHEMA
// ==========================================
export const whatsAppButtonSchema = z.object({
  type: WhatsAppButtonTypeEnum,
  text: z.string().min(1, "Button text is required").max(25, "Button text cannot exceed 25 characters"),
  url: z.string().url("Invalid URL format").optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  example: z.array(z.string()).optional().nullable(),
});

// ==========================================
// VARIABLE MAPPING UPDATE SCHEMA
// ==========================================
export const updateVariableMappingItemSchema = z.object({
  variableId: z.string().uuid("Invalid variable ID format"),
  mappingEntity: CrmMappingEntityEnum.nullable().optional(),
  mappingField: z.string().min(1).max(100).nullable().optional(),
  fallbackValue: z.string().max(255).nullable().optional(),
  label: z.string().max(100).nullable().optional(),
  isRequired: z.boolean().optional(),
});

// ==========================================
// CREATE VARIABLE MAPPING INPUT SCHEMA
// ==========================================
export const createVariableMappingItemSchema = z.object({
  component: WhatsAppVariableComponentEnum.default(WhatsAppVariableComponent.BODY),
  position: z.number().int().min(1),
  parameter: z.string().min(3).max(10), // e.g. "{{1}}"
  mappingEntity: CrmMappingEntityEnum.nullable().optional(),
  mappingField: z.string().min(1).max(100).nullable().optional(),
  fallbackValue: z.string().max(255).nullable().optional(),
  label: z.string().max(100).nullable().optional(),
  isRequired: z.boolean().default(true),
});

// ==========================================
// CREATE TEMPLATE SCHEMA (POST /templates)
// ==========================================
export const createWhatsAppTemplateSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, "Template name is required")
      .max(512, "Template name cannot exceed 512 characters")
      .regex(/^[a-z0-9_]+$/, "Template name must contain only lowercase alphanumeric characters and underscores"),
    category: WhatsAppTemplateCategoryEnum,
    language: z.string().min(2).max(10).default("en_US"),
    headerType: WhatsAppHeaderTypeEnum.default(WhatsAppHeaderType.NONE),
    headerText: z.string().max(60).optional().nullable(),
    headerMedia: z.any().optional().nullable(),
    bodyText: z.string().min(1, "Body text is required").max(1024, "Body text cannot exceed 1024 characters"),
    bodyExamples: z.array(z.string()).optional().nullable(),
    footerText: z.string().max(60).optional().nullable(),
    buttons: z.array(whatsAppButtonSchema).max(10).optional().nullable(),
    variables: z.array(createVariableMappingItemSchema).optional(),
    submitToMeta: z.boolean().default(true),
    additionalInformation: z.any().optional(),
  }),
});

// ==========================================
// UPDATE TEMPLATE SCHEMA (PUT /templates/:id)
// ==========================================
export const updateWhatsAppTemplateSchema = z.object({
  body: z.object({
    category: WhatsAppTemplateCategoryEnum.optional(),
    isEnabled: z.boolean().optional(),
    headerType: WhatsAppHeaderTypeEnum.optional(),
    headerText: z.string().max(60).optional().nullable(),
    headerMedia: z.any().optional().nullable(),
    bodyText: z.string().min(1).max(1024).optional(),
    bodyExamples: z.array(z.string()).optional().nullable(),
    footerText: z.string().max(60).optional().nullable(),
    buttons: z.array(whatsAppButtonSchema).max(10).optional().nullable(),
    variables: z.array(updateVariableMappingItemSchema).optional(),
    resubmitToMeta: z.boolean().default(false),
    additionalInformation: z.any().optional(),
  }),
});

// ==========================================
// QUERY FILTERS SCHEMA (GET /templates)
// ==========================================
export const getWhatsAppTemplatesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().optional(),
    category: WhatsAppTemplateCategoryEnum.optional(),
    status: WhatsAppTemplateStatusEnum.optional(),
    language: z.string().optional(),
    sortBy: z.enum(["createdAt", "name", "status", "category", "updatedAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
});

// ==========================================
// RENDER VARIABLE PREVIEW SCHEMA (POST /templates/:id/render)
// ==========================================
export const renderTemplatePreviewSchema = z.object({
  body: z.object({
    leadId: z.string().uuid().optional().nullable(),
    customerId: z.string().uuid().optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    quotationId: z.string().uuid().optional().nullable(),
    meetingId: z.string().uuid().optional().nullable(),
    employeeId: z.string().uuid().optional().nullable(),
    customOverrides: z.record(z.string(), z.string()).optional(),
  }),
});

export type CreateWhatsAppTemplateDto = z.infer<typeof createWhatsAppTemplateSchema>["body"];
export type CreateVariableMappingItemDto = z.infer<typeof createVariableMappingItemSchema>;
export type UpdateWhatsAppTemplateDto = z.infer<typeof updateWhatsAppTemplateSchema>["body"];
export type GetWhatsAppTemplatesQueryDto = z.infer<typeof getWhatsAppTemplatesQuerySchema>["query"];
export type RenderTemplatePreviewDto = z.infer<typeof renderTemplatePreviewSchema>["body"];
export type UpdateVariableMappingItemDto = z.infer<typeof updateVariableMappingItemSchema>;
export type WhatsAppButtonDto = z.infer<typeof whatsAppButtonSchema>;
