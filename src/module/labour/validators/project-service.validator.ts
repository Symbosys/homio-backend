import { z } from "zod";
import { additionalInformationSchema } from "./labour.validator.js";

export const PROJECT_SERVICE_CATEGORIES = [
  "CIVIL_MASONRY",
  "CARPENTRY_WOODWORK",
  "ELECTRICAL",
  "PLUMBING",
  "PAINTING_POLISHING",
  "FABRICATION_METAL",
  "TILING_FLOORING",
  "FALSE_CEILING_POP",
  "HVAC_VENTILATION",
  "GLASS_ALUMINUM",
  "CLEANING_DEEP_CLEAN",
  "WATERPROOFING",
  "INTERIOR_FITOUT",
  "DEMOLITION_SITE_PREP",
  "LANDSCAPING",
  "GENERAL_MAINTENANCE",
  "CARPENTRY",
  "PAINTING",
  "MASONRY",
  "HVAC",
  "CIVIL",
  "FLOORING",
  "OTHER",
] as const;

export type ProjectServiceCategory = (typeof PROJECT_SERVICE_CATEGORIES)[number];

/**
 * 1. CREATE PROJECT SERVICE SCHEMA
 */
export const createProjectServiceSchema = z.object({
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
    title: z.string().min(2, "Service title must be at least 2 characters").max(200),
    category: z.enum(PROJECT_SERVICE_CATEGORIES),
    description: z.string().optional().nullable(),
    scopeOfWork: z.string().optional().nullable(),
    location: z.string().optional().nullable(), // e.g. "Living Room & Balcony"
    status: z
      .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"])
      .default("PLANNED"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    estimatedDurationDays: z.coerce.number().int().positive().default(1),
    estimatedBudget: z.coerce.number().nonnegative().default(0),
    supervisorId: z.string().uuid("Invalid supervisor ID format").optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 2. UPDATE PROJECT SERVICE SCHEMA (Symmetric full editability - Rule 19)
 */
export const updateProjectServiceSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid service ID format"),
  }),
  body: z.object({
    projectId: z.string().uuid("Invalid project ID format").optional(),
    title: z.string().min(2, "Service title must be at least 2 characters").max(200).optional(),
    category: z.enum(PROJECT_SERVICE_CATEGORIES).optional(),
    description: z.string().optional().nullable(),
    scopeOfWork: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    status: z
      .enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"])
      .optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    estimatedDurationDays: z.coerce.number().int().positive().optional(),
    estimatedBudget: z.coerce.number().nonnegative().optional(),
    supervisorId: z.string().uuid("Invalid supervisor ID format").optional().nullable(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * 3. UPDATE PROJECT SERVICE STATUS SCHEMA
 */
export const updateProjectServiceStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid service ID format"),
  }),
  body: z.object({
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "ON_HOLD", "CANCELLED"]),
  }),
});

/**
 * 4. GET PROJECT SERVICES QUERY SCHEMA
 */
export const getProjectServicesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    projectId: z.string().uuid().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    supervisorId: z.string().uuid().optional(),
    search: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
});

/**
 * 5. PROJECT SERVICE ID PARAM SCHEMA
 */
export const projectServiceIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid project service ID format"),
  }),
});

export type CreateProjectServiceInput = z.infer<typeof createProjectServiceSchema>["body"];
export type UpdateProjectServiceInput = z.infer<typeof updateProjectServiceSchema>["body"];
export type GetProjectServicesQuery = z.infer<typeof getProjectServicesQuerySchema>["query"];
