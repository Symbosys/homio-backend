import { z } from "zod";
import { additionalInformationSchema } from "./labour.validator.js";

/**
 * 1. CREATE LABOUR RATING SCHEMA
 */
export const createLabourRatingSchema = z.object({
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format"),
    labourId: z.string().uuid("Invalid labour ID format"),
    reviewerName: z.string().min(2, "Reviewer name must be at least 2 characters").max(100),
    reviewerRole: z.enum(["SUPERVISOR", "CLIENT", "MANAGER"]).default("SUPERVISOR"),
    rating: z.coerce.number().min(1, "Rating must be between 1.0 and 5.0").max(5, "Rating must be between 1.0 and 5.0"),
    qualityScore: z.coerce.number().min(1).max(5).optional().nullable(),
    punctualityScore: z.coerce.number().min(1).max(5).optional().nullable(),
    behaviourScore: z.coerce.number().min(1).max(5).optional().nullable(),
    reviewNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE LABOUR RATING SCHEMA (Symmetric editability - Rule 19)
 */
export const updateLabourRatingSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid rating ID format"),
  }),
  body: z.object({
    bookingId: z.string().uuid("Invalid booking ID format").optional(),
    labourId: z.string().uuid("Invalid labour ID format").optional(),
    reviewerName: z.string().min(2).max(100).optional(),
    reviewerRole: z.enum(["SUPERVISOR", "CLIENT", "MANAGER"]).optional(),
    rating: z.coerce.number().min(1).max(5).optional(),
    qualityScore: z.coerce.number().min(1).max(5).optional().nullable(),
    punctualityScore: z.coerce.number().min(1).max(5).optional().nullable(),
    behaviourScore: z.coerce.number().min(1).max(5).optional().nullable(),
    reviewNotes: z.string().optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. GET ALL RATINGS QUERY SCHEMA
 */
export const getLabourRatingsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    labourId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    reviewerRole: z.string().optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
  }),
});

/**
 * 4. RATING ID PARAM SCHEMA
 */
export const ratingIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid rating ID format"),
  }),
});

export type CreateLabourRatingInput = z.infer<typeof createLabourRatingSchema>["body"];
export type UpdateLabourRatingInput = z.infer<typeof updateLabourRatingSchema>["body"];
export type GetLabourRatingsQuery = z.infer<typeof getLabourRatingsQuerySchema>["query"];
