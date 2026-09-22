import { z } from "zod";

export const warrantyClaimStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "INSPECTION_SCHEDULED",
  "APPROVED",
  "REJECTED",
  "WORK_IN_PROGRESS",
  "RESOLVED",
  "SETTLED",
]);

/**
 * Validator schema for creating a warranty claim
 */
export const createWarrantyClaimSchema = z.object({
  warrantyId: z.string().uuid("Invalid warranty ID format"),
  title: z.string().min(2, "Title must be at least 2 characters").max(255),
  description: z.string().min(5, "Description must be at least 5 characters"),
  areaRoom: z.string().max(100).optional().nullable(),
  claimDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid claimDate format").optional(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating a warranty claim
 */
export const updateWarrantyClaimSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  description: z.string().min(5).optional(),
  areaRoom: z.string().max(100).optional().nullable(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for reviewing a warranty claim
 */
export const reviewWarrantyClaimSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "UNDER_REVIEW", "INSPECTION_SCHEDULED", "WORK_IN_PROGRESS", "RESOLVED", "SETTLED"]),
  approvedCoverageAmount: z.coerce.number().min(0).optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
});

/**
 * Validator schema for listing warranty claims
 */
export const getWarrantyClaimsQuerySchema = z.object({
  warrantyId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  status: warrantyClaimStatusEnum.optional(),
  reviewedById: z.string().uuid().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for claim ID param
 */
export const claimIdParamSchema = z.object({
  id: z.string().uuid("Invalid claim ID format"),
});

export type CreateWarrantyClaimInput = z.infer<typeof createWarrantyClaimSchema>;
export type UpdateWarrantyClaimInput = z.infer<typeof updateWarrantyClaimSchema>;
export type ReviewWarrantyClaimInput = z.infer<typeof reviewWarrantyClaimSchema>;
export type GetWarrantyClaimsQueryInput = z.infer<typeof getWarrantyClaimsQuerySchema>;
