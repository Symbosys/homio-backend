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
