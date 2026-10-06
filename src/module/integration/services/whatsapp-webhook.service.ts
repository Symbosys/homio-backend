import { whatsAppIntegrationRepo } from "../repos/whatsapp-integration.repo.js";
import { wsService } from "../../../lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../../lib/websocket/ws.types.js";
import {
  CommunicationChannel,
  MessageDirection,
  MessageContentType,
  MessageStatus,
} from "../../../types/types.js";
import type {
  MetaWhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
  MetaWebhookMessage,
  MetaWebhookContact,
} from "../types/index.js";
import {
  addWhatsAppInboundMessageJob,
  addWhatsAppStatusUpdateJob,
} from "../../../queues/webhook/whatsapp-webhook.queue.js";

/**
 * Service handling Meta WhatsApp Cloud API Webhook verification,
 * fast real-time WebSocket event emission, and job enqueuing to BullMQ background workers.
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
   * Processes incoming Meta WhatsApp Webhook event payload (messages, media, statuses).
   * Instantly emits real-time WebSocket events for immediate UI responsiveness and
   * delegates heavy DB persistence, lead checking/creation, and state transitions to BullMQ workers.
   *
   * @param payload Full JSON payload dispatched by Meta Graph API
   */
  async processWebhookEvent(
    payload: MetaWhatsAppWebhookPayload,
  ): Promise<void> {
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

        // Resolve tenant organization by Phone Number ID or WABA ID
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
            `[WhatsApp Webhook] No tenant WhatsApp integration found for phone_number_id: "${phoneNumberId}" or account_id: "${wabaId}". Skipping event processing.`,
          );
          continue;
        }

        const organizationId = integration.organizationId;
        const receivedAt = new Date().toISOString();

        // 1. Process Delivery Status Updates -> Enqueue to BullMQ
        if (value.statuses && value.statuses.length > 0) {
          try {
            await addWhatsAppStatusUpdateJob({
              organizationId,
              statuses: value.statuses,
              receivedAt,
            });
            console.log(
              `[WhatsApp Webhook] Enqueued ${value.statuses.length} status update(s) to BullMQ for Org: "${organizationId}"`,
            );
          } catch (err: any) {
            console.error(
              `[WhatsApp Webhook] Error enqueuing status updates to BullMQ:`,
              err.message,
            );
          }
        }

        // 2. Process Inbound Messages from Customers
        const messages = value.messages || [];
        if (messages.length === 0) {
          continue;
        }

        const contacts = value.contacts || [];

        for (const message of messages) {
          try {
            // A. Instantly emit real-time WebSocket event for instant UI display
            this.emitInstantWebSocketPreview(
              organizationId,
              message,
              contacts,
              phoneNumberId,
              displayPhoneNumber,
            );

            // B. Enqueue message to BullMQ worker for heavy DB storage and lead resolution
            await addWhatsAppInboundMessageJob({
              organizationId,
              message,
              contacts,
              phoneNumberId,
              displayPhoneNumber,
              receivedAt,
            });

            console.log(
              `[WhatsApp Webhook] Enqueued inbound message "${message.id}" from "${message.from}" to BullMQ for Org: "${organizationId}"`,
            );
          } catch (err: unknown) {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            console.error(
              `[WhatsApp Webhook] Error enqueuing message ID "${message.id}" for organization "${organizationId}":`,
              errorMessage,
            );
          }
        }
      }
    }
  }

  /**
   * Helper to parse and emit an instant optimistic WebSocket event so UI reflects incoming message with 0 latency.
   */
  private emitInstantWebSocketPreview(
    organizationId: string,
    message: MetaWebhookMessage,
    contacts: MetaWebhookContact[],
    phoneNumberId?: string,
    displayPhoneNumber?: string,
  ): void {
    const rawSenderPhone = message.from;
    const matchedContact =
      contacts.find((c) => c.wa_id === rawSenderPhone) || contacts[0];
    const profileName =
      matchedContact?.profile?.name?.trim() || "WhatsApp User";

    let messageText = "";
    let msgContentType: MessageContentType = MessageContentType.TEXT;
    const msgType = message.type || "text";

    if (msgType === "text" && message.text) {
      messageText = message.text.body?.trim() || "";
    } else if (msgType === "button" && message.button) {
      messageText = message.button.text?.trim() || message.button.payload || "";
      msgContentType = MessageContentType.INTERACTIVE;
    } else if (msgType === "interactive" && message.interactive) {
      messageText =
        message.interactive.button_reply?.title ||
        message.interactive.list_reply?.title ||
        message.interactive.button_reply?.id ||
        "[Interactive Button Selection]";
      msgContentType = MessageContentType.INTERACTIVE;
    } else if (msgType === "image") {
      messageText = message.image?.caption?.trim() || "[Image]";
      msgContentType = MessageContentType.IMAGE;
    } else if (msgType === "video") {
      messageText = message.video?.caption?.trim() || "[Video]";
      msgContentType = MessageContentType.VIDEO;
    } else if (msgType === "document") {
      messageText = message.document?.filename
        ? `[Document: ${message.document.filename}]`
        : "[Document]";
      msgContentType = MessageContentType.DOCUMENT;
    } else if (msgType === "audio" || msgType === "voice") {
      messageText = "[Voice/Audio Message]";
      msgContentType = MessageContentType.AUDIO;
    } else if (msgType === "location" && message.location) {
      messageText = `[Location: ${message.location.name || message.location.address || "Shared Location"}]`;
      msgContentType = MessageContentType.LOCATION;
    } else if (msgType === "contacts") {
      messageText = `[Contact: ${message.contacts?.[0]?.name?.formatted_name || "Shared Contact"}]`;
      msgContentType = MessageContentType.CONTACT;
    } else {
      messageText = "[Incoming WhatsApp message]";
    }

    const previewMessage = {
      id: `preview_${message.id}`,
      externalMessageId: message.id,
      senderType: "CUSTOMER",
      senderName: profileName,
      direction: MessageDirection.INCOMING,
      replyChannel: CommunicationChannel.WHATSAPP,
      contentType: msgContentType,
      content: messageText,
      status: MessageStatus.DELIVERED,
      createdAt: new Date().toISOString(),
      metadata: {
        rawMessage: message,
        contacts,
        phoneNumberId,
        displayPhoneNumber,
        isOptimisticPreview: true,
      },
    };

    // Broadcast instant preview event to tenant organization room
    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.MESSAGE_RECEIVED,
      previewMessage,
    );
  }
}

export const whatsAppWebhookService = new WhatsAppWebhookService();
