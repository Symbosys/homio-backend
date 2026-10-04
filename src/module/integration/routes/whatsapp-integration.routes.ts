import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getWhatsAppIntegration,
  saveWhatsAppIntegration,
  verifyWhatsAppIntegration,
  disconnectWhatsAppIntegration,
} from "../controllers/whatsapp-integration.controller.js";
import {
  handleWhatsAppWebhookVerification,
  handleWhatsAppWebhookEvent,
} from "../controllers/whatsapp-webhook.controller.js";

const router = Router();
// https://showman-subsoil-kindness.ngrok-free.dev/api/v1/integrations/whatsapp/webhook

// ==========================================
// PUBLIC META WEBHOOK ROUTES (NO AUTH HEADER)
// ==========================================

/**
 * @route   GET /api/v1/integrations/whatsapp/webhook
 * @desc    Meta WhatsApp Webhook verification challenge
 * @access  Public (Called directly by Meta servers)
 */
router.get("/webhook", handleWhatsAppWebhookVerification);

/**
 * @route   POST /api/v1/integrations/whatsapp/webhook
 * @desc    Meta WhatsApp incoming webhook event notifications (messages, statuses)
 * @access  Public (Dispatched directly by Meta servers)
 */
router.post("/webhook", handleWhatsAppWebhookEvent);

// ==========================================
// AUTHENTICATED TENANT ROUTES
// ==========================================

/**
 * All subsequent routes are scoped to the authenticated tenant organization
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
