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
 * Zod schema for room design generation request
 */
export const GenerateRoomDesignSchema = z.object({
  roomType: z.string().min(1, "Room type is required").max(100),
  designStyle: z.string().min(1, "Design style is required").max(100),
  colorPalette: z.array(z.string()).optional().default([]),
  materialPreferences: z.array(z.string()).optional().default([]),
  lightingMode: z.string().max(100).optional().default("Day Natural Sunlight"),
  customInstructions: z.string().max(1000).optional(),
  imageCount: z.coerce.number().int().min(1, "At least 1 image output is required").max(4, "Maximum 4 outputs per generation").default(1),
  beforeImages: z.array(ImageTypeSchema).optional().nullable(),
  beforeImage: ImageTypeSchema.optional().nullable(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type GenerateRoomDesignInput = z.infer<typeof GenerateRoomDesignSchema>;

/**
 * Zod schema for querying past room design sessions
 */
export const QueryRoomDesignSessionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(12),
  search: z.string().optional(),
  roomType: z.string().optional(),
  designStyle: z.string().optional(),
});

export type QueryRoomDesignSessionsInput = z.infer<
  typeof QueryRoomDesignSessionsSchema
>;

/**
 * Zod schema for updating a room design session title/metadata
 */
export const UpdateRoomDesignSessionSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  roomType: z.string().max(100).optional(),
  designStyle: z.string().max(100).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateRoomDesignSessionInput = z.infer<
  typeof UpdateRoomDesignSessionSchema
>;
