import { z } from "zod";

export const teamStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const createTeamSchema = z.object({
  params: z.object({
    departmentId: z.string().uuid("Invalid department ID format").optional(),
  }).optional(),
  body: z.object({
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    name: z.string({ message: "Team name is required" }).trim().min(1, "Team name cannot be empty").max(100),
    code: z
      .string({ message: "Team code is required" })
      .trim()
      .min(1, "Team code cannot be empty")
      .max(20)
      .toUpperCase(),
    description: z.string().trim().nullable().optional(),
    teamLeadId: z.string().uuid("Invalid team lead ID").nullable().optional(),
    status: teamStatusEnum.default("ACTIVE").optional(),
  }),
});

export const updateTeamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid team ID format"),
  }),
  body: z.object({
    departmentId: z.string().uuid("Invalid department ID format").optional(),
    name: z.string().trim().min(1, "Team name cannot be empty").max(100).optional(),
    code: z.string().trim().min(1, "Team code cannot be empty").max(20).toUpperCase().optional(),
    description: z.string().trim().nullable().optional(),
    teamLeadId: z.string().uuid("Invalid team lead ID").nullable().optional(),
    status: teamStatusEnum.optional(),
  }),
});

export const teamIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid team ID format"),
  }),
});

export const departmentTeamsParamSchema = z.object({
  params: z.object({
    departmentId: z.string().uuid("Invalid department ID format"),
  }),
});

export const getTeamsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    departmentId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    status: teamStatusEnum.optional(),
    sortBy: z.enum(["createdAt", "name", "code"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>["body"];
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>["body"];
export type GetTeamsQueryInput = z.infer<typeof getTeamsQuerySchema>["query"];
