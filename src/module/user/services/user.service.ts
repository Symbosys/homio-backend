import bcrypt from "bcryptjs";
import { userRepo } from "../repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  GetUsersQueryInput,
  AssignPermissionsInput,
  CreateRoleInput,
  UpdateRoleInput,
  GetRolesQueryInput,
  GetPermissionsQueryInput,
} from "../validators/user.validator.js";

export class UserService {
  /**
   * Create a new user with hashed password and optional roles
   */
  async createUser(input: CreateUserInput, actorId?: string) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhone = input.phone ? input.phone.trim() : null;

    const existingEmail = await userRepo.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ErrorResponse("User with this email already exists", statusCode.Conflict);
    }

    if (normalizedPhone) {
      const existingPhone = await userRepo.findByPhone(normalizedPhone, true);
      if (existingPhone) {
        throw new ErrorResponse("User with this phone number already exists", statusCode.Conflict);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await userRepo.create({
      email: normalizedEmail,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName ? input.lastName.trim() : null,
      phone: normalizedPhone,
      avatarUrl: input.avatarUrl || null,
      status: input.status,
      userType: input.userType,
      invitedById: actorId,
      roleIds: input.roleIds,
    });

    const { passwordHash: _, ...safeUser } = user as any;
    return safeUser;
  }

  /**
   * Retrieve paginated users with filtering & search
   */
  async getUsers(query: GetUsersQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const { users, total } = await userRepo.findMany({
      skip,
      take: limit,
      search: query.search,
      status: query.status,
      userType: query.userType,
      roleId: query.roleId,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single user by ID with full roles and permissions
   */
  async getUserById(id: string) {
    const user = await userRepo.findById(id, true);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const { passwordHash: _, ...safeUser } = user as any;
    return safeUser;
  }

  /**
   * Update an existing user's information
   */
  async updateUser(id: string, input: UpdateUserInput, actorId?: string) {
    const user = await userRepo.findById(id);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const normalizedPhone = input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : undefined;

    if (normalizedPhone && normalizedPhone !== user.phone) {
      const existingPhone = await userRepo.findByPhone(normalizedPhone, true);
      if (existingPhone && existingPhone.id !== id) {
        throw new ErrorResponse("Phone number is already associated with another account", statusCode.Conflict);
      }
    }

    const updated = await userRepo.update(id, {
      ...input,
      firstName: input.firstName ? input.firstName.trim() : undefined,
      lastName: input.lastName !== undefined ? (input.lastName ? input.lastName.trim() : null) : undefined,
      phone: normalizedPhone,
    });
    const { passwordHash: _, ...safeUser } = updated as any;
    return safeUser;
  }

  /**
   * Soft-delete a user
   */
  async deleteUser(id: string, actorId?: string) {
    const user = await userRepo.findById(id);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    if (actorId && actorId === id) {
      throw new ErrorResponse("Cannot delete your own account", statusCode.Bad_Request);
    }

    await userRepo.softDelete(id);
    return { message: "User deleted successfully" };
  }

  /**
   * Reset user password
   */
  async resetPassword(id: string, newPassword: string, actorId?: string) {
    const user = await userRepo.findById(id);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await userRepo.updatePassword(id, passwordHash);
    return { message: "Password reset successfully. Active sessions have been invalidated." };
  }

  /**
   * Assign roles to a user
   */
  async assignRoles(id: string, roleIds: string[], actorId?: string) {
    const user = await userRepo.findById(id);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const updatedRoles = await userRepo.assignRoles(id, roleIds, actorId);
    return {
      userId: id,
      roles: updatedRoles.map((ur) => ur.role),
    };
  }

  /**
   * Assign direct permission overrides to a user
   */
  async assignPermissions(
    id: string,
    permissions: AssignPermissionsInput["permissions"],
    actorId?: string
  ) {
    const user = await userRepo.findById(id);
    if (!user) {
      throw new ErrorResponse("User not found", statusCode.Not_Found);
    }

    const assigned = await userRepo.assignPermissions(id, permissions, actorId);
    return {
      userId: id,
      permissions: assigned,
    };
  }

  // ==========================================
  // ROLES MANAGEMENT SERVICES
  // ==========================================

  /**
   * Create a new role
   */
  async createRole(input: CreateRoleInput) {
    const slug =
      input.slug ||
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const existingRole = await userRepo.findRoleBySlug(slug);
    if (existingRole) {
      throw new ErrorResponse(`Role with slug '${slug}' already exists`, statusCode.Conflict);
    }

    return userRepo.createRole({
      name: input.name,
      slug,
      description: input.description,
      isActive: input.isActive ?? true,
      permissionIds: input.permissionIds,
    });
  }

  /**
   * Get all roles
   */
  async getRoles(query: GetRolesQueryInput) {
    return userRepo.findRoles({
      search: query.search,
      isActive: query.isActive,
    });
  }

  /**
   * Get single role by ID
   */
  async getRoleById(id: string) {
    const role = await userRepo.findRoleById(id);
    if (!role) {
      throw new ErrorResponse("Role not found", statusCode.Not_Found);
    }
    return role;
  }

  /**
   * Update role
   */
  async updateRole(id: string, input: UpdateRoleInput) {
    const role = await userRepo.findRoleById(id);
    if (!role) {
      throw new ErrorResponse("Role not found", statusCode.Not_Found);
    }

    if (input.slug && input.slug !== role.slug) {
      const existingSlug = await userRepo.findRoleBySlug(input.slug);
      if (existingSlug && existingSlug.id !== id) {
        throw new ErrorResponse(`Role with slug '${input.slug}' already exists`, statusCode.Conflict);
      }
    }

    return userRepo.updateRole(id, input);
  }

  /**
   * Delete role
   */
  async deleteRole(id: string) {
    const role = await userRepo.findRoleById(id);
    if (!role) {
      throw new ErrorResponse("Role not found", statusCode.Not_Found);
    }

    if (role.isSystem) {
      throw new ErrorResponse("System default roles cannot be deleted", statusCode.Bad_Request);
    }

    if (role._count?.users > 0) {
      throw new ErrorResponse(
        `Cannot delete role because it is currently assigned to ${role._count.users} user(s). Reassign them first.`,
        statusCode.Bad_Request
      );
    }

    await userRepo.deleteRole(id);
    return { message: "Role deleted successfully" };
  }

  /**
   * Assign permissions to role
   */
  async assignRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await userRepo.findRoleById(roleId);
    if (!role) {
      throw new ErrorResponse("Role not found", statusCode.Not_Found);
    }

    return userRepo.assignRolePermissions(roleId, permissionIds);
  }

  // ==========================================
  // PERMISSIONS MANAGEMENT SERVICES
  // ==========================================

  /**
   * Get all system permissions
   */
  async getPermissions(query: GetPermissionsQueryInput) {
    return userRepo.findPermissions({
      resource: query.resource,
      search: query.search,
    });
  }
}

export const userService = new UserService();