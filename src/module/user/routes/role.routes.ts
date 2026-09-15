import { Router } from "express";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import { ROLE_PERMISSIONS } from "../../../types/permission.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

// Protect all role management endpoints with authentication
router.use(authenticate);

// CREATE_ROLE
router.post(
  "/",
  requirePermission(ROLE_PERMISSIONS.CREATE_ROLE),
  userController.createRole
);

// READ_ROLE (List roles)
router.get(
  "/",
  requirePermission(ROLE_PERMISSIONS.READ_ROLE),
  userController.getRoles
);

// READ_ROLE (Get single role by ID)
router.get(
  "/:id",
  requirePermission(ROLE_PERMISSIONS.READ_ROLE),
  userController.getRoleById
);

// UPDATE_ROLE
router.patch(
  "/:id",
  requirePermission(ROLE_PERMISSIONS.UPDATE_ROLE),
  userController.updateRole
);

// DELETE_ROLE
router.delete(
  "/:id",
  requirePermission(ROLE_PERMISSIONS.DELETE_ROLE),
  userController.deleteRole
);

// ASSIGN_PERMISSION_ROLE
router.post(
  "/:id/permissions",
  requirePermission(ROLE_PERMISSIONS.ASSIGN_PERMISSION_ROLE),
  userController.assignRolePermissions
);

export default router;
