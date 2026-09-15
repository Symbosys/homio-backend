import { Router } from "express";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import { USER_PERMISSIONS } from "../../../types/permission.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

// Protect all user management endpoints with authentication
router.use(authenticate);

// CREATE_USER
router.post(
  "/",
  requirePermission(USER_PERMISSIONS.CREATE_USER),
  userController.createUser
);

// READ_USER (List paginated users)
router.get(
  "/",
  requirePermission(USER_PERMISSIONS.READ_USER),
  userController.getUsers
);

// READ_USER (Get single user by ID)
router.get(
  "/:id",
  requirePermission(USER_PERMISSIONS.READ_USER),
  userController.getUserById
);

// UPDATE_USER
router.patch(
  "/:id",
  requirePermission(USER_PERMISSIONS.UPDATE_USER),
  userController.updateUser
);

// DELETE_USER
router.delete(
  "/:id",
  requirePermission(USER_PERMISSIONS.DELETE_USER),
  userController.deleteUser
);

// RESET_PASSWORD_USER
router.post(
  "/:id/reset-password",
  requirePermission(USER_PERMISSIONS.RESET_PASSWORD_USER),
  userController.resetPassword
);

// ASSIGN_ROLE_USER
router.post(
  "/:id/roles",
  requirePermission(USER_PERMISSIONS.ASSIGN_ROLE_USER),
  userController.assignRoles
);

// ASSIGN_PERMISSION_USER
router.post(
  "/:id/permissions",
  requirePermission(USER_PERMISSIONS.ASSIGN_PERMISSION_USER),
  userController.assignPermissions
);

export default router;
