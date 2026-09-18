import { z } from "zod";

export const departmentStatusEnum = z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]);

export const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string({ message: "Department name is required" }).trim().min(1, "Department name cannot be empty").max(100),
    code: z
      .string({ message: "Department code is required" })
      .trim()
      .min(1, "Department code cannot be empty")
      .max(20)
      .toUpperCase(),
    description: z.string().trim().nullable().optional(),
    headOfDepartmentId: z.string().uuid("Invalid head of department ID").nullable().optional(),
    costCenterCode: z.string().trim().nullable().optional(),
    budget: z.coerce.number().min(0, "Budget cannot be negative").nullable().optional(),
    status: departmentStatusEnum.default("ACTIVE").optional(),
  }),
});

export const updateDepartmentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid department ID format"),
  }),
  body: createDepartmentSchema.shape.body.partial(),
});

export const departmentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid department ID format"),
  }),
});

export const getDepartmentsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
    status: departmentStatusEnum.optional(),
    sortBy: z.enum(["createdAt", "name", "code"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>["body"];
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>["body"];
export type GetDepartmentsQueryInput = z.infer<typeof getDepartmentsQuerySchema>["query"];
