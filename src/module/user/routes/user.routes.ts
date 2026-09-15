import { Router } from "express";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import { Permissions } from "../../../types/permission.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

// Protect all user management endpoints with authentication
router.use(authenticate);

// CREATE_USER
router.post(
  "/",
  requirePermission(Permissions.CREATE_USER),
  userController.createUser
);

// READ_USER (List paginated users)
router.get(
  "/",
  requirePermission(Permissions.READ_USER),
  userController.getUsers
);

// READ_USER (Get single user by ID)
router.get(
  "/:id",
  requirePermission(Permissions.READ_USER),
  userController.getUserById
);

// UPDATE_USER
router.patch(
  "/:id",
  requirePermission(Permissions.UPDATE_USER),
  userController.updateUser
);

// DELETE_USER
router.delete(
  "/:id",
  requirePermission(Permissions.DELETE_USER),
  userController.deleteUser
);

// RESET_PASSWORD_USER
router.post(
  "/:id/reset-password",
  requirePermission(Permissions.RESET_PASSWORD_USER),
  userController.resetPassword
);

// ASSIGN_ROLE_USER
router.post(
  "/:id/roles",
  requirePermission(Permissions.ASSIGN_ROLE_USER),
  userController.assignRoles
);

// ASSIGN_PERMISSION_USER
router.post(
  "/:id/permissions",
  requirePermission(Permissions.ASSIGN_PERMISSION_USER),
  userController.assignPermissions
);

export default router;
