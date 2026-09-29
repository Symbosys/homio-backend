import { z } from "zod";
import {
  ProgressMediaType,
  ProgressMediaUploadStatus,
  StorageProviderType,
} from "../../../types/types.js";

// =============================================================================
// 1. ZOD ENUMS (Rule 22: z.nativeEnum)
// =============================================================================

export const ProgressMediaTypeEnum = z.nativeEnum(ProgressMediaType);
export const ProgressMediaUploadStatusEnum = z.nativeEnum(ProgressMediaUploadStatus);
export const StorageProviderTypeEnum = z.nativeEnum(StorageProviderType);

// =============================================================================
// 2. PARAMS SCHEMAS
// =============================================================================

export const progressMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    progressId: z.string().uuid("Invalid progress ID format"),
  }),
});

export const singleProgressMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid media ID format"),
  }),
});

export const confirmProgressMediaParamsSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    progressId: z.string().uuid("Invalid progress ID format"),
    mediaId: z.string().uuid("Invalid media ID format"),
  }),
});

// =============================================================================
// 3. PRESIGNED URL REQUEST SCHEMA
// =============================================================================

/**
 * Schema for requesting S3 presigned PUT URL for direct client-to-cloud upload
 */
export const getPresignedProgressMediaUrlSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    progressId: z.string().uuid("Invalid progress ID format"),
  }),
  body: z.object({
    fileName: z.string().min(1, "fileName is required").max(255),
    mimeType: z.string().min(1, "mimeType is required").max(100),
    fileSizeBytes: z.coerce.number().positive().optional().nullable(),
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
export const confirmProgressMediaUploadSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    progressId: z.string().uuid("Invalid progress ID format"),
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
 * Schema for direct backend multipart upload (form-data)
 */
export const createDirectProgressMediaSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    progressId: z.string().uuid("Invalid progress ID format"),
  }),
  body: z.object({
    mediaType: ProgressMediaTypeEnum.default(ProgressMediaType.IMAGE).optional(),
    title: z.string().max(255).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    takenAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid takenAt date format" })
      .optional()
      .nullable(),
    geoLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    geoLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    tags: z
      .union([
        z.array(z.string()),
        z.string().transform((str) => {
          try {
            const parsed = JSON.parse(str);
            return Array.isArray(parsed) ? parsed : [str];
          } catch {
            return str.split(",").map((s) => s.trim()).filter(Boolean);
          }
        }),
      ])
      .default([])
      .optional(),
    isCover: z.coerce.boolean().default(false).optional(),
    orderIndex: z.coerce.number().int().default(0).optional(),
    uploadedById: z.string().uuid("Invalid uploadedById format").optional().nullable(),
    additionalInformation: z
      .union([
        z.record(z.string(), z.any()),
        z.string().transform((str) => {
          try {
            return JSON.parse(str);
          } catch {
            return {};
          }
        }),
      ])
      .optional()
      .nullable(),
  }),
});

// =============================================================================
// 6. UPDATE PROGRESS MEDIA SCHEMA (Rule 5: Partial / Dirty update)
// =============================================================================

export const updateProgressMediaSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    id: z.string().uuid("Invalid media ID format"),
  }),
  body: z.object({
    title: z.string().max(255).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    isCover: z.boolean().optional(),
    orderIndex: z.coerce.number().int().optional(),
    tags: z.array(z.string().max(50)).optional(),
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
// 7. GET PROGRESS MEDIA QUERY SCHEMA
// =============================================================================

export const getProgressMediaQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50).optional(),
    progressId: z.string().uuid("Invalid progress ID format").optional(),
    mediaType: ProgressMediaTypeEnum.optional(),
    uploadStatus: ProgressMediaUploadStatusEnum.optional(),
    isCover: z.coerce.boolean().optional(),
    search: z.string().max(100).optional(),
    startDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid startDate format" })
      .optional(),
    endDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid endDate format" })
      .optional(),
    sortBy: z.enum(["createdAt", "takenAt", "orderIndex", "fileSizeBytes"]).default("orderIndex").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc").optional(),
  }),
});

// =============================================================================
// 8. TYPE INFERENCES
// =============================================================================

export type GetPresignedProgressMediaUrlInput = z.infer<typeof getPresignedProgressMediaUrlSchema>["body"];
export type ConfirmProgressMediaUploadInput = z.infer<typeof confirmProgressMediaUploadSchema>["body"];
export type CreateDirectProgressMediaInput = z.infer<typeof createDirectProgressMediaSchema>["body"];
export type UpdateProgressMediaInput = z.infer<typeof updateProgressMediaSchema>["body"];
export type GetProgressMediaQueryInput = z.infer<typeof getProgressMediaQuerySchema>["query"];
