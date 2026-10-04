import type { Request, Response } from "express";
import { whatsAppWebhookService } from "../services/whatsapp-webhook.service.js";
import type {
  MetaWhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
} from "../types/index.js";

/**
 * Controller: Handle Meta WhatsApp Webhook GET Verification Challenge
 * @route   GET /api/v1/integrations/whatsapp/webhook
 * @desc    Responds to Meta's hub.challenge verification request with the echoed challenge
 * @access  Public (Called directly by Meta Graph API servers)
 */
export const handleWhatsAppWebhookVerification = async (
  req: Request<unknown, unknown, unknown, WhatsAppWebhookVerificationQuery>,
  res: Response,
): Promise<Response | void> => {
  try {
    const challenge = await whatsAppWebhookService.verifyWebhook(req.query);

    if (challenge) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send("Forbidden: Invalid verification token");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      "[WhatsApp Webhook] Verification Controller Error:",
      errorMessage,
    );
    return res.status(500).send("Internal Server Error");
  }
};

/**
 * Controller: Handle Meta WhatsApp Webhook POST Event Notifications
 * @route   POST /api/v1/integrations/whatsapp/webhook
 * @desc    Receives incoming WhatsApp messages, media, and status events, logs payload, and captures CRM leads
 * @access  Public (Dispatched directly by Meta Graph API servers)
 */
export const handleWhatsAppWebhookEvent = async (
  req: Request<unknown, unknown, MetaWhatsAppWebhookPayload>,
  res: Response,
): Promise<Response> => {
  try {
    // Process webhook event in service (logs response and captures CRM lead)
    await whatsAppWebhookService.processWebhookEvent(req.body);

    // Promptly return 200 OK so Meta acknowledges successful delivery and does not retry
    return res.status(200).json({ status: "EVENT_RECEIVED" });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      "[WhatsApp Webhook] Event Processing Controller Error:",
      errorMessage,
    );
    // Still return 200 to prevent Meta webhook delivery storm/infinite retry loop on unhandled edge cases
    return res
      .status(200)
      .json({ status: "ERROR_HANDLED", error: errorMessage });
  }
};
