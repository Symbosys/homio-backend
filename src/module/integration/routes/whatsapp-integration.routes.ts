import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getWhatsAppIntegration,
  saveWhatsAppIntegration,
  verifyWhatsAppIntegration,
  disconnectWhatsAppIntegration,
} from "../controllers/whatsapp-integration.controller.js";

const router = Router();

/**
 * All routes are scoped to the authenticated tenant organization
 */
router.use(authenticate);

/**
 * @route   GET /api/v1/integrations/whatsapp
 * @desc    Fetch current organization's WhatsApp integration credentials and status
 */
router.get("/", getWhatsAppIntegration);

/**
 * @route   POST /api/v1/integrations/whatsapp
 * @desc    Save / update organization's WhatsApp credentials
 */
router.post("/", saveWhatsAppIntegration);

/**
 * @route   POST /api/v1/integrations/whatsapp/verify
 * @desc    Test & verify credentials with Meta Graph API
 */
router.post("/verify", verifyWhatsAppIntegration);

/**
 * @route   DELETE /api/v1/integrations/whatsapp
 * @desc    Disconnect & remove WhatsApp integration
 */
router.delete("/", disconnectWhatsAppIntegration);

export default router;
