import type { Job } from "bullmq";
import { createWorker } from "../../lib/queue/index.js";
import { prisma } from "../../lib/prisma.js";
import { leadService } from "../../module/leads-crm/services/lead.service.js";
import { conversationRepo } from "../../module/communication/repos/conversation.repo.js";
import { chatMessageRepo } from "../../module/communication/repos/chat-message.repo.js";
import { wsService } from "../../lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../lib/websocket/ws.types.js";
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
} from "../../types/types.js";
import {
  WHATSAPP_WEBHOOK_QUEUE_NAME,
  type WhatsAppWebhookJobData,
  type InboundMessageJobData,
  type StatusUpdateJobData,
} from "../../queues/webhook/whatsapp-webhook.queue.js";
import { addAiReplyJob } from "../../queues/ai/ai-reply.queue.js";
import type { MetaWebhookStatus } from "../../module/integration/types/index.js";

/**
 * WhatsApp Webhook Background Worker
 * Processes inbound customer messages, ensures lead resolution (no duplicates),
 * persists chat messages idempotently, and synchronizes real-time conversation state.
 */
export async function processWhatsAppWebhookJob(job: Job<WhatsAppWebhookJobData>): Promise<void> {
  const data = job.data;

  if (data.jobType === "INBOUND_MESSAGE") {
    await processInboundMessage(data);
  } else if (data.jobType === "STATUS_UPDATE") {
    await processStatusUpdates(data);
  }
}

/**
 * Worker processor for inbound customer WhatsApp messages.
 */
export async function processInboundMessage(data: InboundMessageJobData): Promise<void> {
  const {
    organizationId,
    message,
    contacts,
    phoneNumberId,
    displayPhoneNumber,
  } = data;

  const rawSenderPhone = message.from;
  if (!rawSenderPhone) return;

  const senderPhone = rawSenderPhone.startsWith("+")
    ? rawSenderPhone
    : `+${rawSenderPhone}`;

  const normalizedDigits = rawSenderPhone.replace(/\D/g, "");
  const last10Digits = normalizedDigits.slice(-10);

  // Extract sender profile name
  const matchedContact =
    contacts.find((c) => c.wa_id === rawSenderPhone) || contacts[0];
  const profileName =
    matchedContact?.profile?.name?.trim() || "WhatsApp User";

  const nameSegments = profileName.split(/\s+/);
  const firstName = nameSegments[0] || "WhatsApp";
  const lastName =
    nameSegments.length > 1 ? nameSegments.slice(1).join(" ") : "Lead";

  // Parse message content and type
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
      `[WhatsApp Worker] Active Lead EXISTS with Code "${existingLead.leadCode}" (ID: ${existingLead.id}) for Phone ${senderPhone}.`,
    );
  } else {
    console.log(
      `[WhatsApp Worker] No active lead found for Phone ${senderPhone}. Creating new CRM Lead for Organization "${organizationId}"...`,
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
      `[WhatsApp Worker] SUCCESS: New Lead created with Code: "${createdLead.leadCode}" (ID: ${createdLead.id})`,
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
    conversation = (await conversationRepo.create(organizationId, {
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
    })) as any;
    isNewConversation = true;
  } else {
    if (!conversation.leadId) {
      await conversationRepo.update(conversation.id, organizationId, {
        lead: { connect: { id: leadId } },
      });
    }
  }

  if (!conversation) {
    console.error("[WhatsApp Webhook] Could not find or create conversation thread.");
    return;
  }

  // =========================================================================
  // STEP 3: IDEMPOTENT MESSAGE STORAGE
  // =========================================================================
  const existingMessage = await chatMessageRepo.findByExternalMessageId(message.id);
  if (existingMessage) {
    console.log(
      `[WhatsApp Worker] Message ID "${message.id}" already stored in DB. Skipping duplicate insert.`,
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

  const refreshedConversation = await conversationRepo.findById(
    conversation.id,
    organizationId,
  );

  // =========================================================================
  // STEP 5: REAL-TIME WEBSOCKET BROADCASTS (CONFIRMED PERSISTED DB STATE)
  // =========================================================================
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
    `[WhatsApp Worker] Successfully processed inbound message "${message.id}" for conversation "${conversation.id}" (Org: "${organizationId}")`,
  );

  // =========================================================================
  // STEP 6: CONDITIONAL AUTONOMOUS AI REPLY ENQUEUEING (3-SECOND DELAY)
  // =========================================================================
  if (conversation.handlingMode === ConversationHandlingMode.AI_AUTONOMOUS) {
    try {
      await addAiReplyJob(
        {
          organizationId,
          conversationId: conversation.id,
          incomingMessageId: createdMessage.id,
          incomingMessageText: messageText,
          senderPhone,
          senderName: profileName,
          leadId,
          enqueuedAt: new Date().toISOString(),
        },
        3000, // 3-second delay
      );
      console.log(
        `[WhatsApp Worker] Enqueued AI Reply job for conversation "${conversation.id}" (Delay: 3s, Mode: AI_AUTONOMOUS, Org: "${organizationId}")`,
      );
    } catch (err: any) {
      console.error(
        `[WhatsApp Worker] Failed to enqueue AI Reply job for conversation "${conversation.id}":`,
        err.message,
      );
    }
  } else {
    console.log(
      `[WhatsApp Worker] Conversation "${conversation.id}" handlingMode is "${conversation.handlingMode}". Skipping AI reply queue.`,
    );
  }
}

/**
 * Worker processor for message delivery status updates.
 */
export async function processStatusUpdates(data: StatusUpdateJobData): Promise<void> {
  const { organizationId, statuses } = data;

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
        errorDetails.errorMessage =
          err.title || err.message || "Message delivery failed on Meta network";
      }
    }

    await chatMessageRepo.updateStatusByExternalId(
      externalMessageId,
      mappedStatus,
      timestamps,
      errorDetails,
    );

    const message = await chatMessageRepo.findByExternalMessageId(externalMessageId);

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
 * Creates and starts the WhatsApp webhook BullMQ worker instance.
 */
export function startWhatsAppWebhookWorker() {
  return createWorker<WhatsAppWebhookJobData>(
    WHATSAPP_WEBHOOK_QUEUE_NAME,
    processWhatsAppWebhookJob,
    {
      concurrency: 10,
    },
  );
}
