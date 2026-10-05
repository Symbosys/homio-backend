import { prisma } from "../../../lib/prisma.js";
import { whatsAppIntegrationRepo } from "../repos/whatsapp-integration.repo.js";
import { leadService } from "../../leads-crm/services/lead.service.js";
import { conversationRepo } from "../../communication/repos/conversation.repo.js";
import { chatMessageRepo } from "../../communication/repos/chat-message.repo.js";
import { wsService } from "../../../lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../../lib/websocket/ws.types.js";
import {
  LeadPriority,
  LeadProjectType,
  LeadSource,
  LeadStatus,
  CommunicationChannel,
  ConversationStatus,
  ConversationHandlingMode,
  MessageDirection,
  MessageContentType,
  MessageStatus,
} from "../../../types/types.js";
import type {
  MetaWhatsAppWebhookPayload,
  WhatsAppWebhookVerificationQuery,
  IncomingMessageProcessingParams,
  MetaWebhookStatus,
} from "../types/index.js";

/**
 * Service handling Meta WhatsApp Cloud API Webhook verification,
 * conditional CRM Lead creation (no duplicates when active lead exists),
 * Omnichannel Conversation thread linkage, and Real-Time WebSocket event broadcasts.
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
   * Logs incoming response, updates delivery status receipts, links conversations,
   * conditionally creates CRM Leads on absence, and broadcasts real-time WebSocket events.
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

        // 1. Process Delivery Status Updates (sent, delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          await this.handleStatusUpdates(organizationId, value.statuses);
        }

        // 2. Process Inbound Messages from Customers
        const messages = value.messages || [];
        if (messages.length === 0) {
          continue;
        }

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
   * Process delivery status updates and broadcast to WebSocket rooms
   */
  private async handleStatusUpdates(
    organizationId: string,
    statuses: MetaWebhookStatus[],
  ): Promise<void> {
    for (const s of statuses) {
      const externalMessageId = s.id;
      const metaStatus = s.status?.toLowerCase();
      const timestampSeconds = Number(s.timestamp) || Math.floor(Date.now() / 1000);
      const timestampDate = new Date(timestampSeconds * 1000);

      let mappedStatus: MessageStatus = MessageStatus.SENT;
      const timestamps: { deliveredAt?: Date; readAt?: Date } = {};
      const errorDetails: { errorCode?: string; errorMessage?: string } = {};

      if (metaStatus === "delivered") {
        mappedStatus = MessageStatus.DELIVERED;
        timestamps.deliveredAt = timestampDate;
      } else if (metaStatus === "read") {
        mappedStatus = MessageStatus.READ;
        timestamps.readAt = timestampDate;
      } else if (metaStatus === "sent") {
        mappedStatus = MessageStatus.SENT;
      } else if (metaStatus === "failed") {
        mappedStatus = MessageStatus.FAILED;
        const err = s.errors?.[0];
        if (err) {
          errorDetails.errorCode = String(err.code || "META_DELIVERY_FAILED");
          errorDetails.errorMessage = err.title || err.message || "Message delivery failed on Meta network";
        }
      }

      await chatMessageRepo.updateStatusByExternalId(
        externalMessageId,
        mappedStatus,
        timestamps,
        errorDetails,
      );

      // Find the message to get its conversationId for targeted socket broadcast
      const message = await chatMessageRepo.findByExternalMessageId(externalMessageId);

      // Broadcast real-time status update to both conversation room and tenant organization
      const eventData = {
        externalMessageId,
        messageId: message?.id,
        conversationId: message?.conversationId,
        status: mappedStatus,
        deliveredAt: timestamps.deliveredAt?.toISOString(),
        readAt: timestamps.readAt?.toISOString(),
        errorCode: errorDetails.errorCode,
        errorMessage: errorDetails.errorMessage,
      };

      if (message?.conversationId) {
        wsService.broadcastToConversation(
          message.conversationId,
          WebSocketEventType.MESSAGE_STATUS_UPDATED,
          eventData,
        );
      }

      wsService.broadcastToOrganization(
        organizationId,
        WebSocketEventType.MESSAGE_STATUS_UPDATED,
        eventData,
      );
    }
  }

  /**
   * Internal helper to parse message content, link/create CRM Lead conditionally,
   * create/update conversation thread, save chat message, and trigger WebSocket broadcasts.
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

    const rawSenderPhone = message.from; // e.g. "916202999356"
    if (!rawSenderPhone) {
      return;
    }

    const senderPhone = rawSenderPhone.startsWith("+")
      ? rawSenderPhone
      : `+${rawSenderPhone}`;

    const normalizedDigits = rawSenderPhone.replace(/\D/g, "");
    const last10Digits = normalizedDigits.slice(-10);

    // Extract sender name from Meta contacts profile
    const matchedContact =
      contacts.find((c) => c.wa_id === rawSenderPhone) || contacts[0];
    const profileName =
      matchedContact?.profile?.name?.trim() || "WhatsApp User";

    // Split name into first and last name
    const nameSegments = profileName.split(/\s+/);
    const firstName = nameSegments[0] || "WhatsApp";
    const lastName =
      nameSegments.length > 1 ? nameSegments.slice(1).join(" ") : "Lead";

    // Extract readable message body and content type
    let messageText = "";
    let msgContentType: MessageContentType = MessageContentType.TEXT;
    let mediaPayload: Record<string, unknown> | null = null;
    const msgType = message.type || "text";

    if (msgType === "text" && message.text) {
      messageText = message.text.body?.trim() || "";
      msgContentType = MessageContentType.TEXT;
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
    } else if (msgType === "image" && message.image) {
      const caption = message.image.caption?.trim();
      messageText = caption ? caption : "[Image]";
      msgContentType = MessageContentType.IMAGE;
      mediaPayload = {
        id: message.image.id,
        mime_type: message.image.mime_type,
        sha256: message.image.sha256,
      };
    } else if (msgType === "video" && message.video) {
      const caption = message.video.caption?.trim();
      messageText = caption ? caption : "[Video]";
      msgContentType = MessageContentType.VIDEO;
      mediaPayload = {
        id: message.video.id,
        mime_type: message.video.mime_type,
      };
    } else if (msgType === "document" && message.document) {
      const caption = message.document.caption?.trim();
      const filename = message.document.filename;
      messageText = caption ? caption : filename ? `[Document: ${filename}]` : "[Document]";
      msgContentType = MessageContentType.DOCUMENT;
      mediaPayload = {
        id: message.document.id,
        filename,
        mime_type: message.document.mime_type,
      };
    } else if (msgType === "audio" || msgType === "voice") {
      messageText = `[Voice/Audio Message]`;
      msgContentType = MessageContentType.AUDIO;
      mediaPayload = {
        id: message.audio?.id || message.voice?.id,
        mime_type: message.audio?.mime_type || message.voice?.mime_type,
      };
    } else if (msgType === "location" && message.location) {
      const loc = message.location;
      messageText =
        `[Location: ${loc.name || ""} ${loc.address || ""} (Lat: ${loc.latitude}, Lng: ${loc.longitude})]`.trim();
      msgContentType = MessageContentType.LOCATION;
      mediaPayload = loc as any;
    } else if (msgType === "contacts" && message.contacts) {
      messageText = `[Contact: ${message.contacts[0]?.name?.formatted_name || "Shared Contact"}]`;
      msgContentType = MessageContentType.CONTACT;
      mediaPayload = message.contacts as any;
    } else {
      messageText = `[Incoming WhatsApp message]`;
      msgContentType = MessageContentType.TEXT;
    }

    // =========================================================================
    // STEP 1: CONDITIONAL CRM LEAD RESOLUTION (NO DUPLICATE LEADS)
    // =========================================================================
    let leadId: string;

    // Check if an active non-deleted Lead already exists for this customer's phone number in this organization
    const existingLead = await prisma.lead.findFirst({
      where: {
        organizationId,
        isDeleted: false,
        customer: {
          phone: { contains: last10Digits },
        },
      },
      orderBy: { createdAt: "desc" },
      include: { customer: true },
    });

    if (existingLead) {
      leadId = existingLead.id;
      console.log(
        `[WhatsApp Webhook] Active Lead EXISTS with Code "${existingLead.leadCode}" (ID: ${existingLead.id}) for Phone ${senderPhone}. Attaching message without creating duplicate lead.`,
      );
    } else {
      // No active lead exists for this number -> Create a brand new CRM Lead
      console.log(
        `[WhatsApp Webhook] No active lead found for Phone ${senderPhone}. Creating new CRM Lead for Organization "${organizationId}"...`,
      );

      const createdLead = await leadService.createLead(organizationId, {
        title: `WhatsApp Inquiry from ${profileName}`,
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

      leadId = createdLead.id;
      console.log(
        `[WhatsApp Webhook] SUCCESS: New Lead created with Code: "${createdLead.leadCode}" (ID: ${createdLead.id})`,
      );
    }

    // =========================================================================
    // STEP 2: FIND OR CREATE OMNICHANNEL CONVERSATION THREAD
    // =========================================================================
    let conversation = await conversationRepo.findByRecipientPhone(
      organizationId,
      normalizedDigits,
      CommunicationChannel.WHATSAPP,
    );

    let isNewConversation = false;

    if (!conversation) {
      conversation = await conversationRepo.create(organizationId, {
        channel: CommunicationChannel.WHATSAPP,
        status: ConversationStatus.OPEN,
        priority: "NORMAL",
        handlingMode: ConversationHandlingMode.MANUAL_HUMAN,
        externalThreadId: rawSenderPhone,
        recipientPhone: senderPhone,
        recipientName: profileName,
        leadId,
        unreadCount: 0,
        lastMessageText: messageText,
        lastMessageAt: new Date(),
        lastMessageDirection: MessageDirection.INCOMING,
        tags: ["WhatsApp Inbound"],
      });
      isNewConversation = true;
    } else {
      // If conversation exists but was linked to an older lead, keep it current or preserve
      if (!conversation.leadId) {
        await conversationRepo.update(conversation.id, organizationId, {
          lead: { connect: { id: leadId } },
        });
      }
    }

    // =========================================================================
    // STEP 3: IDEMPOTENT MESSAGE STORAGE
    // =========================================================================
    const existingMessage = await chatMessageRepo.findByExternalMessageId(message.id);
    if (existingMessage) {
      console.log(
        `[WhatsApp Webhook] Message ID "${message.id}" already processed. Skipping duplicate insert.`,
      );
      return;
    }

    const createdMessage = await chatMessageRepo.create({
      conversationId: conversation.id,
      senderType: "CUSTOMER",
      senderName: profileName,
      direction: MessageDirection.INCOMING,
      replyChannel: CommunicationChannel.WHATSAPP,
      contentType: msgContentType,
      content: messageText,
      media: mediaPayload as any,
      status: MessageStatus.DELIVERED,
      externalMessageId: message.id,
      metadata: {
        rawMessage: message as any,
        contacts: contacts as any,
        phoneNumberId,
        displayPhoneNumber,
      } as any,
    });

    // =========================================================================
    // STEP 4: UPDATE CONVERSATION UNREAD COUNT & LAST ACTIVITY
    // =========================================================================
    await conversationRepo.recordInboundMessage(
      conversation.id,
      messageText,
      new Date(),
    );

    // Fetch refreshed conversation for broadcasts
    const refreshedConversation = await conversationRepo.findById(
      conversation.id,
      organizationId,
    );

    // =========================================================================
    // STEP 5: REAL-TIME WEBSOCKET BROADCASTS (IMMEDIATE UI REFLECTION)
    // =========================================================================
    // 1. Broadcast message to everyone viewing this conversation thread and organization
    wsService.broadcastToConversation(
      conversation.id,
      WebSocketEventType.MESSAGE_RECEIVED,
      createdMessage,
    );

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.MESSAGE_RECEIVED,
      createdMessage,
    );

    // 2. Broadcast conversation updated / created to entire organization
    if (isNewConversation) {
      wsService.broadcastToOrganization(
        organizationId,
        WebSocketEventType.CONVERSATION_CREATED,
        refreshedConversation,
      );
    }

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_UPDATED,
      refreshedConversation,
    );

    console.log(
      `[WhatsApp Webhook] Inbound message recorded & broadcasted via WebSocket to conversation "${conversation.id}" (Org: "${organizationId}")`,
    );
  }
}

export const whatsAppWebhookService = new WhatsAppWebhookService();
