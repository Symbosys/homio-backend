import { z } from "zod";
import {
  ComplaintMediaStage,
  ProgressMediaType,
  ProgressMediaUploadStatus,
  StorageProviderType,
} from "../../../types/types.js";

// =============================================================================
// 1. ZOD ENUMS (Rule 22: z.nativeEnum)
// =============================================================================

export const ComplaintMediaStageEnum = z.nativeEnum(ComplaintMediaStage);
export const ProgressMediaTypeEnum = z.nativeEnum(ProgressMediaType);
export const ProgressMediaUploadStatusEnum = z.nativeEnum(ProgressMediaUploadStatus);
export const StorageProviderTypeEnum = z.nativeEnum(StorageProviderType);

// =============================================================================
// 2. PARAMS SCHEMAS
// =============================================================================

export const complaintMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
  }),
});

export const singleComplaintMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid media ID format"),
  }),
});

export const confirmComplaintMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
    mediaId: z.string().uuid("Invalid media ID format"),
  }),
});

// =============================================================================
// 3. PRESIGNED URL REQUEST SCHEMA
// =============================================================================

/**
 * Schema for requesting S3 presigned PUT URL for direct client-to-cloud upload
 */
export const getPresignedComplaintMediaUrlSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    fileName: z.string().min(1, "fileName is required").max(255),
    mimeType: z.string().min(1, "mimeType is required").max(100),
    fileSizeBytes: z.coerce.number().positive().optional().nullable(),
    stageType: ComplaintMediaStageEnum.default(ComplaintMediaStage.BEFORE),
    mediaType: ProgressMediaTypeEnum.default(ProgressMediaType.IMAGE),
    title: z.string().max(255).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    takenAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid takenAt date format" })
      .optional()
      .nullable(),
    geoLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    geoLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    tags: z.array(z.string().max(50)).default([]).optional(),
    isCover: z.boolean().default(false).optional(),
    orderIndex: z.coerce.number().int().default(0).optional(),
    uploadedById: z.string().uuid("Invalid uploadedById format").optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// =============================================================================
// 4. CONFIRM MEDIA UPLOAD SCHEMA
// =============================================================================

/**
 * Schema for confirming completion of direct S3 upload
 */
export const confirmComplaintMediaUploadSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
    mediaId: z.string().uuid("Invalid media ID format"),
  }),
  body: z.object({
    durationSeconds: z.coerce.number().min(0).optional().nullable(),
    width: z.coerce.number().int().positive().optional().nullable(),
    height: z.coerce.number().int().positive().optional().nullable(),
    thumbnailUrl: z.string().url().optional().nullable(),
    fileSizeBytes: z.coerce.number().positive().optional().nullable(),
    uploadStatus: ProgressMediaUploadStatusEnum.default(ProgressMediaUploadStatus.COMPLETED).optional(),
  }),
});

// =============================================================================
// 5. DIRECT MULTIPART UPLOAD SCHEMA
// =============================================================================

/**
 * Schema for validating multipart direct file upload payload
 */
export const createDirectComplaintMediaSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format"),
  }),
  body: z.object({
    stageType: ComplaintMediaStageEnum.default(ComplaintMediaStage.BEFORE).optional(),
    title: z.string().max(255).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    mediaType: ProgressMediaTypeEnum.default(ProgressMediaType.IMAGE).optional(),
    takenAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid takenAt date format" })
      .optional()
      .nullable(),
    geoLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    geoLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    tags: z.union([z.array(z.string()), z.string()]).transform((val) => {
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [val];
        } catch {
          return val ? [val] : [];
        }
      }
      return val || [];
    }).optional(),
    isCover: z.union([z.boolean(), z.string()]).transform((val) => val === true || val === "true").optional(),
    orderIndex: z.coerce.number().int().default(0).optional(),
    uploadedById: z.string().uuid("Invalid uploadedById format").optional().nullable(),
    additionalInformation: z.union([z.record(z.string(), z.any()), z.string()]).transform((val) => {
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    }).optional().nullable(),
  }),
});

// =============================================================================
// 6. UPDATE MEDIA SCHEMA (Rule 5: Partial / Dirty Updates)
// =============================================================================

export const updateComplaintMediaSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid media ID format"),
  }),
  body: z.object({
    stageType: ComplaintMediaStageEnum.optional(),
    title: z.string().max(255).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    tags: z.array(z.string().max(50)).optional(),
    isCover: z.boolean().optional(),
    orderIndex: z.coerce.number().int().optional(),
    takenAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid takenAt date format" })
      .optional()
      .nullable(),
    geoLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    geoLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

// =============================================================================
// 7. QUERY FILTER SCHEMA (Rule 7 & Rule 8: Debounced Search & Filters)
// =============================================================================

export const getComplaintMediaQuerySchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    complaintId: z.string().uuid("Invalid complaint ID format").optional(),
  }),
  query: z.object({
    complaintId: z.string().uuid().optional(),
    stageType: ComplaintMediaStageEnum.optional(),
    mediaType: ProgressMediaTypeEnum.optional(),
    uploadStatus: ProgressMediaUploadStatusEnum.optional(),
    uploadedById: z.string().uuid().optional(),
    isCover: z.union([z.boolean(), z.string()]).transform((val) => val === true || val === "true").optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    sortBy: z.enum(["createdAt", "takenAt", "orderIndex"]).default("orderIndex").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
  }),
});

// =============================================================================
// 8. TYPE INFERENCES
// =============================================================================

export type GetPresignedComplaintMediaUrlInput = z.infer<typeof getPresignedComplaintMediaUrlSchema>["body"];
export type ConfirmComplaintMediaUploadInput = z.infer<typeof confirmComplaintMediaUploadSchema>["body"];
export type CreateDirectComplaintMediaInput = z.infer<typeof createDirectComplaintMediaSchema>["body"];
export type UpdateComplaintMediaInput = z.infer<typeof updateComplaintMediaSchema>["body"];
export type GetComplaintMediaQueryInput = z.infer<typeof getComplaintMediaQuerySchema>["query"];
