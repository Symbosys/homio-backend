import { Router } from "express";
import {
  sendTemplateMessage,
  sendCustomMessage,
} from "../controllers/whatsapp-message.controller.js";
import { authenticate, requirePermission } from "../../../middlewares/auth.middleware.js";
import { Permissions } from "../../../types/permission.js";

const router = Router();

router.use(authenticate);

/**
 * @route   POST /api/v1/communication/messages/template
 * @desc    Send a pre-approved WhatsApp message template to any recipient with dynamic CRM variables
 * @access  Private (Requires SEND_COMMUNICATION_MESSAGE permission)
 */
router.post(
  "/template",
  requirePermission(Permissions.SEND_COMMUNICATION_MESSAGE),
  sendTemplateMessage
);

/**
 * @route   POST /api/v1/communication/messages/custom
 * @desc    Send a direct custom message (text, image, video, document) to any recipient phone
 * @access  Private (Requires SEND_COMMUNICATION_MESSAGE permission)
 */
router.post(
  "/custom",
  requirePermission(Permissions.SEND_COMMUNICATION_MESSAGE),
  sendCustomMessage
);

export default router;
