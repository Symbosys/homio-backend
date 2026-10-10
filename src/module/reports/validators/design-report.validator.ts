import { z } from "zod";
import {
  DesignType,
  DesignStage,
  DesignStatus,
  DesignVersionStatus,
  DesignAttachmentType,
  DesignApprovalDecision,
  DesignChangeCategory,
} from "../../../types/types.js";

/**
 * Native Zod Enums synced with Prisma Schema (Rule 22)
 */
export const DesignTypeEnum = z.nativeEnum(DesignType);
export const DesignStageEnum = z.nativeEnum(DesignStage);
export const DesignStatusEnum = z.nativeEnum(DesignStatus);
export const DesignVersionStatusEnum = z.nativeEnum(DesignVersionStatus);
export const DesignAttachmentTypeEnum = z.nativeEnum(DesignAttachmentType);
export const DesignApprovalDecisionEnum = z.nativeEnum(DesignApprovalDecision);
export const DesignChangeCategoryEnum = z.nativeEnum(DesignChangeCategory);

export const DatePresetEnum = z.enum([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_3_months",
  "last_6_months",
  "this_year",
  "all_time",
  "custom",
]);

/**
 * Validator schema for master design reports query
 */
export const getDesignReportsQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional().nullable(),
    employeeId: z.string().uuid("Invalid employee ID format").optional().nullable(),
    folderId: z.string().uuid("Invalid folder ID format").optional().nullable(),
    datePreset: DatePresetEnum.default("this_month").optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    stage: DesignStageEnum.optional().nullable(),
    designType: DesignTypeEnum.optional().nullable(),
    status: DesignStatusEnum.optional().nullable(),
  }),
});

export type GetDesignReportsQueryInput = z.infer<typeof getDesignReportsQuerySchema>["query"];
