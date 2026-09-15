import { z } from "zod";

export const createUserSchema = z.object({
  body: z.object({
    email: z
      .string({ message: "Email is required" })
      .email("Invalid email format")
      .trim()
      .toLowerCase(),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters long"),
    firstName: z
      .string({ message: "First name is required" })
      .trim()
      .min(1, "First name cannot be empty"),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    avatarUrl: z.string().url("Invalid avatar URL").optional(),
    userType: z.enum(["ADMIN", "USER"]).optional().default("USER"),
    status: z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"])
      .optional()
      .default("ACTIVE"),
    roleIds: z.array(z.string().uuid("Invalid role ID format")).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
    lastName: z.string().trim().nullable().optional(),
    phone: z.string().trim().nullable().optional(),
    avatarUrl: z.string().url("Invalid avatar URL").nullable().optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"])
      .optional(),
    userType: z.enum(["ADMIN", "USER"]).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
});

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"])
      .optional(),
    userType: z.enum(["ADMIN", "USER"]).optional(),
    roleId: z.string().uuid("Invalid role ID").optional(),
    sortBy: z
      .enum(["createdAt", "firstName", "email", "status"])
      .optional()
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export const resetPasswordSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    newPassword: z
      .string({ message: "New password is required" })
      .min(8, "Password must be at least 8 characters long"),
  }),
});

export const assignRolesSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    roleIds: z
      .array(z.string().uuid("Invalid role ID format"), {
        message: "roleIds array is required",
      })
      .nonempty("Provide at least one role ID"),
  }),
});

export const assignPermissionsSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid user ID format"),
  }),
  body: z.object({
    permissions: z
      .array(
        z.object({
          permissionId: z.string().uuid("Invalid permission ID format"),
          effect: z.enum(["ALLOW", "DENY"], {
            message: "Effect must be either ALLOW or DENY",
          }),
        }),
        { message: "permissions array is required" }
      )
      .nonempty("Provide at least one permission assignment"),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>["body"];
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type GetUsersQueryInput = z.infer<typeof getUsersQuerySchema>["query"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
export type AssignRolesInput = z.infer<typeof assignRolesSchema>["body"];
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>["body"];
