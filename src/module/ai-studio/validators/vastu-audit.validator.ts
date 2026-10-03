import { z } from "zod";

/**
 * Zod schema for structured image object (ImageType)
 */
export const ImageTypeSchema = z.object({
  id: z.string(),
  url: z.string().url("Invalid image URL"),
  bytes: z.number().nonnegative().default(0),
  format: z.string().default("png"),
  provider: z.string().default("cloudinary"),
});

/**
 * Zod schema for Vastu Spatial Audit generation request
 */
export const GenerateVastuAuditSchema = z.object({
  propertyType: z.string().min(1, "Property type is required").max(100),
  facingDirection: z.string().min(1, "Facing direction is required").max(50),
  totalAreaSqft: z.coerce.number().positive().optional().default(1500),
  numberOfFloors: z.coerce.number().int().min(1).max(50).optional().default(1),
  city: z.string().max(100).optional().default("Bangalore, India"),
  selectedFocusAreas: z.array(z.string()).optional().default([]),
  customInstructions: z.string().max(2000).optional(),
  floorPlanUrl: ImageTypeSchema.optional().nullable(),
  sitePhotos: z.array(ImageTypeSchema).optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type GenerateVastuAuditInput = z.infer<typeof GenerateVastuAuditSchema>;

/**
 * Zod schema for querying past Vastu audit sessions
 */
export const QueryVastuAuditsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  search: z.string().optional(),
  propertyType: z.string().optional(),
  facingDirection: z.string().optional(),
});

export type QueryVastuAuditsInput = z.infer<typeof QueryVastuAuditsSchema>;

/**
 * Zod schema for updating a Vastu audit session metadata
 */
export const UpdateVastuAuditSchema = z.object({
  propertyType: z.string().max(100).optional(),
  facingDirection: z.string().max(50).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateVastuAuditInput = z.infer<typeof UpdateVastuAuditSchema>;
