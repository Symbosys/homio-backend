import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { userService } from "../services/user.service.js";
import {
  createUserSchema,
  updateUserSchema,
  getUsersQuerySchema,
  userIdParamSchema,
  resetPasswordSchema,
  assignRolesSchema,
  assignPermissionsSchema,
  createRoleSchema,
  updateRoleSchema,
  getRolesQuerySchema,
  roleIdParamSchema,
  assignRolePermissionsSchema,
  getPermissionsQuerySchema,
} from "../validators/user.validator.js";

/**
 * Controller: Create user (CREATE_USER)
 */
export const createUser = asyncHandler(async (req, res) => {
  const parsed = createUserSchema.parse({ body: req.body });
  const user = await userService.createUser(parsed.body, req.user?.id);
  return SuccessResponse(res, "User created successfully", user, statusCode.Created);
});

/**
 * Controller: Get paginated users list (READ_USER)
 */
export const getUsers = asyncHandler(async (req, res) => {
  const parsed = getUsersQuerySchema.parse({ query: req.query });
  const result = await userService.getUsers(parsed.query);
  return SuccessResponse(res, "Users retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single user by ID (READ_USER)
 */
export const getUserById = asyncHandler(async (req, res) => {
  const parsed = userIdParamSchema.parse({ params: req.params });
  const user = await userService.getUserById(parsed.params.id);
  return SuccessResponse(res, "User details retrieved successfully", user, statusCode.OK);
});

/**
 * Controller: Update user details (UPDATE_USER)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const parsed = updateUserSchema.parse({ params: req.params, body: req.body });
  const user = await userService.updateUser(parsed.params.id, parsed.body, req.user?.id);
  return SuccessResponse(res, "User updated successfully", user, statusCode.OK);
});

/**
 * Controller: Soft-delete user (DELETE_USER)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const parsed = userIdParamSchema.parse({ params: req.params });
  const result = await userService.deleteUser(parsed.params.id, req.user?.id);
  return SuccessResponse(res, "User deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Reset user password (RESET_PASSWORD_USER)
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const parsed = resetPasswordSchema.parse({ params: req.params, body: req.body });
  const result = await userService.resetPassword(parsed.params.id, parsed.body.newPassword, req.user?.id);
  return SuccessResponse(res, "Password reset successfully", result, statusCode.OK);
});

/**
 * Controller: Assign roles to user (ASSIGN_ROLE_USER)
 */
export const assignRoles = asyncHandler(async (req, res) => {
  const parsed = assignRolesSchema.parse({ params: req.params, body: req.body });
  const result = await userService.assignRoles(parsed.params.id, parsed.body.roleIds, req.user?.id);
  return SuccessResponse(res, "Roles assigned successfully", result, statusCode.OK);
});

/**
 * Controller: Assign direct permission overrides to user (ASSIGN_PERMISSION_USER)
 */
export const assignPermissions = asyncHandler(async (req, res) => {
  const parsed = assignPermissionsSchema.parse({ params: req.params, body: req.body });
  const result = await userService.assignPermissions(
    parsed.params.id,
    parsed.body.permissions,
    req.user?.id
  );
  return SuccessResponse(res, "Permissions assigned successfully", result, statusCode.OK);
});

// ==========================================
// ROLE CONTROLLERS
// ==========================================

/**
 * Controller: Create role (CREATE_ROLE)
 */
export const createRole = asyncHandler(async (req, res) => {
  const parsed = createRoleSchema.parse({ body: req.body });
  const role = await userService.createRole(parsed.body);
  return SuccessResponse(res, "Role created successfully", role, statusCode.Created);
});

/**
 * Controller: Get all roles (READ_ROLE)
 */
export const getRoles = asyncHandler(async (req, res) => {
  const parsed = getRolesQuerySchema.parse({ query: req.query });
  const roles = await userService.getRoles(parsed.query);
  return SuccessResponse(res, "Roles retrieved successfully", roles, statusCode.OK);
});

/**
 * Controller: Get role by ID (READ_ROLE)
 */
export const getRoleById = asyncHandler(async (req, res) => {
  const parsed = roleIdParamSchema.parse({ params: req.params });
  const role = await userService.getRoleById(parsed.params.id);
  return SuccessResponse(res, "Role details retrieved successfully", role, statusCode.OK);
});

/**
 * Controller: Update role (UPDATE_ROLE)
 */
export const updateRole = asyncHandler(async (req, res) => {
  const parsed = updateRoleSchema.parse({ params: req.params, body: req.body });
  const role = await userService.updateRole(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Role updated successfully", role, statusCode.OK);
});

/**
 * Controller: Delete role (DELETE_ROLE)
 */
export const deleteRole = asyncHandler(async (req, res) => {
  const parsed = roleIdParamSchema.parse({ params: req.params });
  const result = await userService.deleteRole(parsed.params.id);
  return SuccessResponse(res, "Role deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Assign permissions to role (ASSIGN_PERMISSION_ROLE)
 */
export const assignRolePermissions = asyncHandler(async (req, res) => {
  const parsed = assignRolePermissionsSchema.parse({ params: req.params, body: req.body });
  const role = await userService.assignRolePermissions(parsed.params.id, parsed.body.permissionIds);
  return SuccessResponse(res, "Role permissions updated successfully", role, statusCode.OK);
});

// ==========================================
// PERMISSION CONTROLLERS
// ==========================================

/**
 * Controller: Get system permissions (READ_PERMISSION)
 */
export const getPermissions = asyncHandler(async (req, res) => {
  const parsed = getPermissionsQuerySchema.parse({ query: req.query });
  const permissions = await userService.getPermissions(parsed.query);
  return SuccessResponse(res, "Permissions retrieved successfully", permissions, statusCode.OK);
});

