import { Router } from "express";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import { SYSTEM_PERMISSIONS } from "../../../types/permission.js";
import * as userController from "../controllers/user.controller.js";

const router = Router();

// Protect all permission catalog endpoints with authentication
router.use(authenticate);

// READ_PERMISSION (List system permissions)
router.get(
  "/",
  requirePermission(SYSTEM_PERMISSIONS.READ_PERMISSION),
  userController.getPermissions
);

export default router;
