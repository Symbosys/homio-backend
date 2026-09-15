import bcrypt from "bcryptjs";
import { userRepo } from "../repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  GetUsersQueryInput,
  AssignPermissionsInput,
} from "../validators/user.validator.js";

export class UserService {
  /**
   * Create a new user with hashed password and optional roles
   */
  async createUser(input: CreateUserInput, actorId?: string) {
    const existingEmail = await userRepo.findByEmail(input.email);
    if (existingEmail) {
      throw new ErrorResponse("User with this email already exists", statusCode.Conflict);
    }

    if (input.phone) {
      const existingPhone = await userRepo.findByPhone(input.phone);
      if (existingPhone) {
        throw new ErrorResponse("User with this phone number already exists", statusCode.Conflict);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await userRepo.create({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      avatarUrl: input.avatarUrl,
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

    if (input.phone && input.phone !== user.phone) {
      const existingPhone = await userRepo.findByPhone(input.phone);
      if (existingPhone && existingPhone.id !== id) {
        throw new ErrorResponse("Phone number is already associated with another account", statusCode.Conflict);
      }
    }

    const updated = await userRepo.update(id, input);
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
}

export const userService = new UserService();