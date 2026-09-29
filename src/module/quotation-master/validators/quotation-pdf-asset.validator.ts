import { z } from "zod";
import { PdfPageImagePosition } from "../../../types/types.js";

/**
 * Zod NativeEnum for PDF Page Image Position strictly mapped from Prisma schema
 */
export const PdfPageImagePositionEnum = z.nativeEnum(PdfPageImagePosition);

/**
 * URL parameter schema for PDF Asset ID
 */
export const pdfAssetIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid PDF Page Asset ID format"),
  }),
});

/**
 * Validator schema for creating a PDF Page Asset via multipart/form-data
 */
export const createPdfAssetSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Asset title is required").max(150, "Title cannot exceed 150 characters"),
    position: PdfPageImagePositionEnum,
    pageTag: z.string().max(50).optional().nullable(),
    isDefault: z.coerce.boolean().optional().default(false),
    isActive: z.coerce.boolean().optional().default(true),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for updating a PDF Page Asset (Partial / Dirty update)
 */
export const updatePdfAssetSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid PDF Page Asset ID format"),
  }),
  body: z.object({
    title: z.string().min(1).max(150).optional(),
    pageTag: z.string().max(50).optional().nullable(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

/**
 * Validator schema for querying / filtering PDF assets
 */
export const getPdfAssetsQuerySchema = z.object({
  query: z.object({
    position: PdfPageImagePositionEnum.optional(),
    search: z.string().optional(),
    pageTag: z.string().optional(),
    isActive: z
      .string()
      .optional()
      .transform((val) => {
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      }),
  }),
});

/**
 * Validator schema for reordering PDF assets within a position
 */
export const reorderPdfAssetsSchema = z.object({
  body: z.object({
    position: PdfPageImagePositionEnum,
    orders: z.array(
      z.object({
        id: z.string().uuid("Invalid Asset ID format"),
        sortOrder: z.coerce.number().int().min(0, "Sort order must be between 0 and 9").max(9, "Max 10 assets allowed (indices 0-9)"),
      })
    ).min(1, "At least one asset order is required").max(10, "Cannot reorder more than 10 assets"),
  }),
});

export type CreatePdfAssetInput = z.infer<typeof createPdfAssetSchema>["body"];
export type UpdatePdfAssetInput = z.infer<typeof updatePdfAssetSchema>["body"];
export type GetPdfAssetsQueryInput = z.infer<typeof getPdfAssetsQuerySchema>["query"];
export type ReorderPdfAssetsInput = z.infer<typeof reorderPdfAssetsSchema>["body"];
