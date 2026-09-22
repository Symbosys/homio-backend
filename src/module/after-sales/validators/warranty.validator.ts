import { z } from "zod";

export const warrantyStatusEnum = z.enum(["ACTIVE", "EXPIRED", "CLAIMED", "VOIDED"]);

/**
 * Validator schema for creating a project warranty
 */
export const createProjectWarrantySchema = z.object({
  projectId: z.string().uuid("Invalid project ID format"),
  handoverId: z.string().uuid("Invalid handover ID format").optional().nullable(),
  category: z.string().min(2).max(100),
  title: z.string().min(2, "Title must be at least 2 characters").max(255),
  description: z.string().optional().nullable(),
  coveredItemWork: z.string().optional().nullable(),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid startDate format"),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid endDate format"),
  status: warrantyStatusEnum.optional().default("ACTIVE"),
  termsSummary: z.string().optional().nullable(),
  inclusions: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
  additionalInformation: z.any().optional(),
});

/**
 * Validator schema for updating a project warranty
 */
export const updateProjectWarrantySchema = createProjectWarrantySchema
  .omit({ projectId: true })
  .partial();

/**
 * Validator schema for updating warranty status
 */
export const updateWarrantyStatusSchema = z.object({
  status: warrantyStatusEnum,
});

/**
 * Validator schema for listing project warranties
 */
export const getProjectWarrantiesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  handoverId: z.string().uuid().optional(),
  status: warrantyStatusEnum.optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Validator schema for warranty ID param
 */
export const warrantyIdParamSchema = z.object({
  id: z.string().uuid("Invalid warranty ID format"),
});

export type CreateProjectWarrantyInput = z.infer<typeof createProjectWarrantySchema>;
export type UpdateProjectWarrantyInput = z.infer<typeof updateProjectWarrantySchema>;
export type UpdateWarrantyStatusInput = z.infer<typeof updateWarrantyStatusSchema>;
export type GetProjectWarrantiesQueryInput = z.infer<typeof getProjectWarrantiesQuerySchema>;
