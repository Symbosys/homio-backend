import { whatsAppIntegrationRepo } from "../repos/whatsapp-integration.repo.js";
import { leadService } from "../../leads-crm/services/lead.service.js";
import {
  LeadPriority,
  LeadProjectType,
  LeadSource,
  LeadStatus,
} from "../../../types/types.js";
import type {
  MetaWhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
  IncomingMessageProcessingParams,
  MetaWebhookStatus,
} from "../types/index.js";

/**
 * Service handling Meta WhatsApp Cloud API Webhook verification and incoming message event processing
 */
export class WhatsAppWebhookService {
  /**
   * Verifies the webhook challenge sent by Meta Graph API during webhook configuration
   * @param query Express query object containing hub.mode, hub.verify_token, hub.challenge
   * @returns The raw challenge string if valid, or null if verification fails
   */
  async verifyWebhook(
    query: WhatsAppWebhookVerificationQuery,
  ): Promise<string | null> {
    const mode = query["hub.mode"] || query.mode;
    const token = query["hub.verify_token"] || query.verify_token;
    const challenge = query["hub.challenge"] || query.challenge;

    console.log("[WhatsApp Webhook] Verification request received:", {
      mode,
      token,
      challenge,
    });

    if (mode === "subscribe" && token && challenge) {
      // 1. Check if token matches any tenant organization's configured verify token
      const integration =
        await whatsAppIntegrationRepo.findByWebhookVerifyToken(token);

      // 2. Check tenant match or system default fallback token
      const isSystemTokenMatch =
        token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
        token === "Homio@2026";

      if (integration || isSystemTokenMatch) {
        console.log(
          `[WhatsApp Webhook] Verification SUCCESSFUL for token: "${token}" (Tenant Match: ${!!integration}, System Match: ${isSystemTokenMatch})`,
        );
        return challenge;
      }

      console.warn(
        `[WhatsApp Webhook] Verification FAILED. Token "${token}" does not match any registered organization verify token.`,
      );
      return null;
    }

    console.warn(
      "[WhatsApp Webhook] Verification FAILED. Invalid mode or missing query parameters:",
      query,
    );
    return null;
  }

  /**
   * Processes incoming Meta WhatsApp Webhook event payload (messages, media, statuses)
   * Logs incoming response and automatically creates/attaches CRM Leads for incoming inquiries
   * @param payload Full JSON payload dispatched by Meta Graph API
   */
  async processWebhookEvent(
    payload: MetaWhatsAppWebhookPayload,
  ): Promise<void> {
    // 1. Explicit console.log of incoming Meta WhatsApp response/payload for full observability
    console.log(
      "\n==================== [WHATSAPP META WEBHOOK INCOMING EVENT] ====================",
    );
    console.log(JSON.stringify(payload, null, 2));
    console.log(
      "================================================================================\n",
    );

    if (!payload || payload.object !== "whatsapp_business_account") {
      console.log(
        "[WhatsApp Webhook] Ignored non-WhatsApp Business Account payload object:",
        payload?.object,
      );
      return;
    }

    const entries = payload.entry || [];

    for (const entry of entries) {
      const wabaId = entry.id; // WhatsApp Business Account ID
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== "messages") {
          continue;
        }

        const value = change.value;
        if (!value) continue;

        const metadata = value.metadata || {};
        const phoneNumberId = metadata.phone_number_id;
        const displayPhoneNumber = metadata.display_phone_number;

        // Log status events if present (sent, delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          console.log(
            `[WhatsApp Webhook] Received ${value.statuses.length} message status event(s) for Phone ID ${phoneNumberId}:`,
            value.statuses.map((s: MetaWebhookStatus) => ({
              id: s.id,
              status: s.status,
              recipient_id: s.recipient_id,
              timestamp: s.timestamp,
            })),
          );
        }

        // Process incoming user messages
        const messages = value.messages || [];
        if (messages.length === 0) {
          continue;
        }

        // 2. Resolve tenant organization by Phone Number ID or WABA ID
        let integration = null;
        if (phoneNumberId) {
          integration =
            await whatsAppIntegrationRepo.findByPhoneNumberId(phoneNumberId);
        }
        if (!integration && wabaId) {
          integration = await whatsAppIntegrationRepo.findByAccountId(wabaId);
        }

        if (!integration) {
          console.warn(
            `[WhatsApp Webhook] No tenant WhatsApp integration found for phone_number_id: "${phoneNumberId}" or account_id: "${wabaId}". Skipping CRM lead auto-creation.`,
          );
          continue;
        }

        const organizationId = integration.organizationId;
        const contacts = value.contacts || [];

        for (const message of messages) {
          try {
            await this.handleIncomingMessage({
              organizationId,
              message,
              contacts,
              phoneNumberId,
              displayPhoneNumber,
            });
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            console.error(
              `[WhatsApp Webhook] Error processing message ID "${message.id}" for organization "${organizationId}":`,
              errorMessage,
            );
          }
        }
      }
    }
  }

  /**
   * Internal helper to parse message content and create or record a CRM Lead
   */
  private async handleIncomingMessage(
    params: IncomingMessageProcessingParams,
  ): Promise<void> {
    const {
      organizationId,
      message,
      contacts,
      phoneNumberId,
      displayPhoneNumber,
    } = params;

    const rawSenderPhone = message.from; // e.g. "919153992738"
    if (!rawSenderPhone) {
      return;
    }

    const senderPhone = rawSenderPhone.startsWith("+")
      ? rawSenderPhone
      : `+${rawSenderPhone}`;

    // Extract sender name from Meta contacts profile
    const matchedContact =
      contacts.find((c) => c.wa_id === rawSenderPhone) || contacts[0];
    const profileName =
      matchedContact?.profile?.name?.trim() || "WhatsApp Lead";

    // Split name into first and last name
    const nameSegments = profileName.split(/\s+/);
    const firstName = nameSegments[0] || "WhatsApp";
    const lastName =
      nameSegments.length > 1 ? nameSegments.slice(1).join(" ") : "Inquiry";

    // Extract readable message body based on message type
    let messageText = "";
    const msgType = message.type || "text";

    if (msgType === "text" && message.text) {
      messageText = message.text.body?.trim() || "";
    } else if (msgType === "button" && message.button) {
      messageText = message.button.text?.trim() || message.button.payload || "";
    } else if (msgType === "interactive" && message.interactive) {
      messageText =
        message.interactive.button_reply?.title ||
        message.interactive.list_reply?.title ||
        message.interactive.button_reply?.id ||
        "[Interactive Button Selection]";
    } else if (msgType === "image" && message.image) {
      const caption = message.image.caption?.trim();
      messageText = caption ? `[IMAGE] ${caption}` : "[Sent a WhatsApp Image]";
    } else if (msgType === "video" && message.video) {
      const caption = message.video.caption?.trim();
      messageText = caption ? `[VIDEO] ${caption}` : "[Sent a WhatsApp Video]";
    } else if (msgType === "document" && message.document) {
      const caption = message.document.caption?.trim();
      const filename = message.document.filename;
      messageText = caption
        ? `[DOCUMENT] ${caption}`
        : filename
          ? `[Sent a WhatsApp Document: ${filename}]`
          : "[Sent a WhatsApp Document]";
    } else if (msgType === "audio" || msgType === "voice") {
      messageText = `[Sent a WhatsApp Audio/Voice Message]`;
    } else if (msgType === "location" && message.location) {
      const loc = message.location;
      messageText =
        `[Location Shared: ${loc.name || ""} ${loc.address || ""} (Lat: ${loc.latitude}, Lng: ${loc.longitude})]`.trim();
    } else if (msgType === "contacts" && message.contacts) {
      messageText = `[Shared Contact Card: ${message.contacts[0]?.name?.formatted_name || "Contact"}]`;
    } else {
      messageText = `[Incoming WhatsApp message of type: ${msgType}]`;
    }

    const leadTitle = messageText
      ? `WhatsApp: ${messageText.slice(0, 60)}${messageText.length > 60 ? "..." : ""}`
      : `WhatsApp Inquiry from ${profileName}`;

    console.log(
      `[WhatsApp Webhook] Creating CRM Lead for Org "${organizationId}" from ${profileName} (${senderPhone}): "${messageText}"`,
    );

    // Create lead in CRM with customer deduplication
    const createdLead = await leadService.createLead(organizationId, {
      title: leadTitle,
      workDescription: messageText || "Inquiry initiated via WhatsApp",
      source: LeadSource.PHONE_INQUIRY,
      status: LeadStatus.NEW,
      priority: LeadPriority.HIGH,
      projectType: LeadProjectType.RESIDENTIAL,
      customer: {
        firstName,
        lastName,
        phone: senderPhone,
      },
      notes: `Captured automatically via WhatsApp Webhook from ${profileName} (${senderPhone}) on ${new Date().toLocaleString()}.\nMeta Message ID: ${message.id}`,
      additionalInformation: {
        sourceChannel: "WHATSAPP",
        whatsappMessageId: message.id,
        whatsappSenderWaId: rawSenderPhone,
        whatsappSenderProfileName: profileName,
        whatsappMessageType: msgType,
        whatsappTimestamp: message.timestamp,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappDisplayPhoneNumber: displayPhoneNumber,
        receivedAt: new Date().toISOString(),
      },
    });

    console.log(
      `[WhatsApp Webhook] SUCCESS: Lead created/linked with Code: "${createdLead.leadCode}" (ID: ${createdLead.id}) for Organization: "${organizationId}"`,
    );
  }
}

export const whatsAppWebhookService = new WhatsAppWebhookService();
