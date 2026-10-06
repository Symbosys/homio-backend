import type { Job } from "bullmq";
import { createWorker } from "../../lib/queue/index.js";
import { prisma } from "../../lib/prisma.js";
import { whatsAppIntegrationRepo } from "../../module/integration/repos/whatsapp-integration.repo.js";
import { llmIntegrationRepo } from "../../module/integration/repos/llm-integration.repo.js";
import { metaWhatsAppService } from "../../module/communication/services/meta-whatsapp.service.js";
import { chatMessageRepo } from "../../module/communication/repos/chat-message.repo.js";
import { conversationRepo } from "../../module/communication/repos/conversation.repo.js";
import { ragService } from "../../ai/rag.service.js";
import {
  serializeToToon,
  updateConversationMemorySummary,
} from "../../ai/utils/toon.serializer.js";
import { wsService } from "../../lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../lib/websocket/ws.types.js";
import {
  ChannelIntegrationStatus,
  CommunicationChannel,
  ConversationHandlingMode,
  ConversationStatus,
  LlmUsageStatus,
  MessageContentType,
  MessageDirection,
  MessageSenderType,
  MessageStatus,
} from "../../types/types.js";
import {
  AI_REPLY_QUEUE_NAME,
  type AiReplyJobData,
} from "../../queues/ai/ai-reply.queue.js";
import type { ChatMessageTurn } from "../../ai/interfaces/ai-rag.interface.js";

/**
 * AI Auto-Reply Background Worker
 * Processes delayed AI reply jobs, builds token-efficient TOON context and bounded conversation summaries,
 * runs verified RAG inference using tenant LLM credentials, dispatches WhatsApp replies, and emits live WebSocket events.
 */
export async function processAiReplyJob(job: Job<AiReplyJobData>): Promise<void> {
  const {
    organizationId,
    conversationId,
    incomingMessageText,
    senderPhone,
    senderName,
  } = job.data;

  console.log(
    `[AI Reply Worker] Processing AI reply job #${job.id} for conversation "${conversationId}" (Org: "${organizationId}")...`,
  );

  // 1. Fetch live conversation record with Lead, Customer, and Funnel context
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      lead: {
        include: {
          customer: true,
          funnel: true,
        },
      },
    },
  });

  if (!conversation || conversation.isDeleted) {
    console.log(`[AI Reply Worker] Conversation "${conversationId}" not found or deleted. Skipping.`);
    return;
  }

  // 2. Strict Mode Check: Autonomous AI Bot Mode Only
  if (conversation.handlingMode !== ConversationHandlingMode.AI_AUTONOMOUS) {
    console.log(
      `[AI Reply Worker] Conversation "${conversationId}" is in mode "${conversation.handlingMode}" (not AI_AUTONOMOUS). Skipping auto-reply.`,
    );
    return;
  }

  if (
    conversation.status === ConversationStatus.RESOLVED ||
    conversation.status === ConversationStatus.ARCHIVED
  ) {
    console.log(
      `[AI Reply Worker] Conversation "${conversationId}" is already ${conversation.status}. Skipping auto-reply.`,
    );
    return;
  }

  // 3. Verify WhatsApp Cloud API Integration credentials
  const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
  if (
    !integration ||
    integration.status !== ChannelIntegrationStatus.ACTIVE ||
    !integration.accessToken ||
    !integration.phoneNumberId
  ) {
    console.warn(
      `[AI Reply Worker] Active WhatsApp integration not configured for Org "${organizationId}". Skipping AI reply dispatch.`,
    );
    return;
  }

  // 4. Build Token-Oriented Object Notation (TOON) Context
  const recipientDisplayName = conversation.recipientName || senderName || "Customer";
  const customerPhone = conversation.recipientPhone || senderPhone;

  const toonObject = {
    customer: {
      name: recipientDisplayName,
      phone: customerPhone,
    },
    lead: conversation.lead
      ? {
          code: conversation.lead.leadCode,
          status: conversation.lead.status,
          priority: conversation.lead.priority,
          projectType: conversation.lead.projectType,
          budget: conversation.lead.budgetInLakh
            ? `${conversation.lead.budgetInLakh} Lakhs`
            : conversation.lead.budgetDisplay || undefined,
          property: conversation.lead.propertyName
            ? `${conversation.lead.propertyName}${conversation.lead.propertyCity ? ` (${conversation.lead.propertyCity})` : ""}`
            : undefined,
          funnel: conversation.lead.funnel?.name,
        }
      : undefined,
  };

  const toonContext = serializeToToon(toonObject);

  // 5. Fetch Recent Dialogue Turns for immediate conversational context
  const recentMessages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  const chatHistory: ChatMessageTurn[] = recentMessages
    .reverse()
    .map((m) => ({
      role: m.direction === MessageDirection.INCOMING ? "user" : "assistant",
      content: m.content,
    }));

  // 6. Generate Context-Aware RAG Response using Tenant's BYOK LLM & Lead Funnel Knowledge Sources
  let aiResult;
  try {
    aiResult = await ragService.generateWhatsAppReply(
      organizationId,
      incomingMessageText,
      {
        senderName: recipientDisplayName,
        leadFunnelId: conversation.lead?.funnelId || undefined,
        chatHistory,
        toonContext,
        conversationSummary: conversation.aiSummary || undefined,
        conversationId,
      },
    );
  } catch (err: any) {
    console.error(
      `[AI Reply Worker] Error generating AI reply for Org "${organizationId}":`,
      err.message,
    );
    return;
  }

  const aiReplyText = aiResult.text?.trim();
  if (!aiReplyText) {
    console.warn(`[AI Reply Worker] Generated empty reply for conversation "${conversationId}". Skipping send.`);
    return;
  }

  // 7. Dispatch Message to Customer via Meta WhatsApp Cloud API
  const cleanPhone = customerPhone.replace(/\D/g, "");
  const metaPayload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: {
      preview_url: false,
      body: aiReplyText,
    },
  };

  let externalMessageId: string | undefined;
  try {
    const metaResponse = await metaWhatsAppService.dispatchMessageToMeta(
      integration.phoneNumberId,
      integration.accessToken,
      metaPayload,
    );
    externalMessageId = metaResponse.messages?.[0]?.id;
  } catch (err: any) {
    console.error(
      `[AI Reply Worker] Failed to dispatch WhatsApp message to ${cleanPhone} via Meta API:`,
      err.message,
    );
    // Even if dispatch to Meta failed, we still log so tenant admin can diagnose
  }

  // 8. Persist Outbound AI Message in Database
  const createdAiMessage = await chatMessageRepo.create({
    conversationId,
    senderType: MessageSenderType.AI_BOT,
    senderName: "AI Assistant",
    direction: MessageDirection.OUTGOING,
    replyChannel: CommunicationChannel.WHATSAPP,
    contentType: MessageContentType.TEXT,
    content: aiReplyText,
    status: externalMessageId ? MessageStatus.SENT : MessageStatus.FAILED,
    externalMessageId: externalMessageId || null,
    aiGenerated: true,
    aiConfidence: aiResult.confidence,
    metadata: {
      modelUsed: aiResult.modelUsed,
      sourcesCount: aiResult.sources.length,
      retrievalSources: aiResult.sources,
      dispatchedVia: "AI_AUTONOMOUS_WORKER",
    } as any,
  });

  // 9. Record Call Ledger in OrganizationLlmUsage Table
  try {
    await llmIntegrationRepo.recordUsage({
      organizationId,
      provider: aiResult.modelUsed.provider,
      modelKey: aiResult.modelUsed.modelKey,
      modelCatalogId: aiResult.usage?.modelCatalogId ?? null,
      credentialId: aiResult.usage?.credentialId ?? null,
      conversationId,
      chatMessageId: createdAiMessage.id,
      status: externalMessageId ? LlmUsageStatus.SUCCESS : LlmUsageStatus.FAILED,
      promptTokens: aiResult.usage?.promptTokens ?? null,
      completionTokens: aiResult.usage?.completionTokens ?? null,
      totalTokens: aiResult.usage?.totalTokens ?? null,
      latencyMs: aiResult.usage?.latencyMs ?? null,
      providerRequestId: externalMessageId || null,
      additionalInformation: {
        channel: "WHATSAPP",
        sourcesCount: aiResult.sources.length,
        retrievalConfidence: aiResult.confidence,
        dispatchedVia: "AI_AUTONOMOUS_WORKER",
      },
    });
  } catch (usageErr: any) {
    console.warn(
      `[AI Reply Worker] Error recording LLM usage for conversation "${conversationId}":`,
      usageErr?.message,
    );
  }

  // 10. Incrementally Update Bounded Conversation Memory Summary (< 1500 words)
  const updatedSummary = updateConversationMemorySummary(
    conversation.aiSummary,
    incomingMessageText,
    aiReplyText,
    1200, // Safe ceiling under 1500 words
  );

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageText: aiReplyText,
      lastMessageAt: new Date(),
      lastMessageDirection: MessageDirection.OUTGOING,
      aiLastInteractedAt: new Date(),
      aiSummary: updatedSummary,
    },
  });

  // 11. Fetch refreshed conversation and broadcast Real-Time WebSocket Events
  const refreshedConversation = await conversationRepo.findById(conversationId, organizationId);

  wsService.broadcastToConversation(
    conversationId,
    WebSocketEventType.MESSAGE_RECEIVED,
    createdAiMessage,
  );

  wsService.broadcastToOrganization(
    organizationId,
    WebSocketEventType.MESSAGE_RECEIVED,
    createdAiMessage,
  );

  wsService.broadcastToOrganization(
    organizationId,
    WebSocketEventType.CONVERSATION_UPDATED,
    refreshedConversation,
  );

  console.log(
    `[AI Reply Worker] SUCCESS: Autonomous AI replied to conversation "${conversationId}" (Phone: ${customerPhone}). Message ID: "${createdAiMessage.id}"`,
  );
}

/**
 * Creates and starts the AI Reply BullMQ worker instance.
 */
export function startAiReplyWorker() {
  return createWorker<AiReplyJobData>(AI_REPLY_QUEUE_NAME, processAiReplyJob, {
    concurrency: 5,
  });
}
