import { Router } from "express";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import upload from "../../../middlewares/upload.middleware.js";
import { Permissions } from "../../../types/permission.js";
import {
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  syncTemplate,
  renderTemplate,
  getVariableDictionary,
  uploadTemplateMedia,
} from "../controllers/whatsapp-template.controller.js";

const router = Router();

/**
 * All routes are scoped to authenticated tenant users
 */
router.use(authenticate);

/**
 * @route   POST /api/v1/communication/templates/upload-media
 * @desc    Upload template header media (image, video, document)
 * Note: Must precede /:id to prevent route shadowing
 */
router.post(
  "/upload-media",
  requirePermission(Permissions.CREATE_COMMUNICATION_TEMPLATE),
  upload.single("file", { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  uploadTemplateMedia
);

/**
 * @route   POST /api/v1/communication/templates
 * @desc    Create template with variable mappings and optional Meta submission
 */
router.post("/", requirePermission(Permissions.CREATE_COMMUNICATION_TEMPLATE), createTemplate);

/**
 * @route   GET /api/v1/communication/templates
 * @desc    API 1: List templates with pagination, filters, sorting & KPI analytics ribbon
 */
router.get("/", requirePermission(Permissions.READ_COMMUNICATION_TEMPLATE), listTemplates);

/**
 * @route   GET /api/v1/communication/templates/variable-dictionary
 * @desc    API 7: Get whitelisted CRM variable dictionary
 * Note: Must precede /:id to prevent route shadowing
 */
router.get(
  "/variable-dictionary",
  requirePermission(Permissions.READ_COMMUNICATION_VARIABLE_DICTIONARY),
  getVariableDictionary
);

/**
 * @route   GET /api/v1/communication/templates/:id
 * @desc    API 2: Get complete template details with dedicated variable mappings
 */
router.get("/:id", requirePermission(Permissions.READ_COMMUNICATION_TEMPLATE), getTemplateById);

/**
 * @route   PUT /api/v1/communication/templates/:id
 * @desc    API 3: Update template components, enabled state, and variable mappings
 */
router.put("/:id", requirePermission(Permissions.UPDATE_COMMUNICATION_TEMPLATE), updateTemplate);

/**
 * @route   DELETE /api/v1/communication/templates/:id
 * @desc    API 4: Soft-delete template locally and dispatch deletion to Meta Graph API
 */
router.delete("/:id", requirePermission(Permissions.DELETE_COMMUNICATION_TEMPLATE), deleteTemplate);

/**
 * @route   POST /api/v1/communication/templates/:id/sync
 * @desc    API 5: Synchronize single template from Meta Graph API
 */
router.post("/:id/sync", requirePermission(Permissions.SYNC_COMMUNICATION_TEMPLATE), syncTemplate);

/**
 * @route   POST /api/v1/communication/templates/:id/render
 * @desc    API 6: Resolve template variable mappings against actual CRM entity records (Read-Only)
 */
router.post("/:id/render", requirePermission(Permissions.RENDER_COMMUNICATION_TEMPLATE), renderTemplate);

export default router;
