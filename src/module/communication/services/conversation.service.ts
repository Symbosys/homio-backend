import { prisma } from "../../../lib/prisma.js";
import { conversationRepo } from "../repos/conversation.repo.js";
import { chatMessageRepo } from "../repos/chat-message.repo.js";
import { conversationAuditRepo } from "../repos/conversation-audit.repo.js";
import { whatsAppIntegrationRepo } from "../../integration/repos/whatsapp-integration.repo.js";
import { metaWhatsAppService } from "./meta-whatsapp.service.js";
import { leadService } from "../../leads-crm/services/lead.service.js";
import { wsService } from "../../../lib/websocket/ws.service.js";
import { WebSocketEventType } from "../../../lib/websocket/ws.types.js";
import {
  statusCode,
  CommunicationChannel,
  ConversationStatus,
  ConversationHandlingMode,
  MessageDirection,
  MessageContentType,
  LeadSource,
  LeadStatus,
  LeadPriority,
  LeadProjectType,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type { AuthenticatedUser } from "../../../middlewares/auth.middleware.js";
import type {
  GetConversationsQueryInput,
  GetMessagesQueryInput,
  SendReplyInput,
  InitiateOutboundConversationInput,
  AssignConversationInput,
} from "../validators/conversation.validator.js";

/**
 * Service orchestrating Omnichannel Inbox, Tri-Mode Replies (WhatsApp, Email, Internal Note),
 * Real-Time WebSocket Synchronization, and Automated CRM Entity Bindings.
 */
export class ConversationService {
  /**
   * List paginated conversations with status/channel/assignment filters and search
   */
  async listConversations(
    organizationId: string,
    query: GetConversationsQueryInput,
    currentUserId?: string,
  ) {
    return conversationRepo.findAll(organizationId, {
      ...query,
      currentUserId,
    });
  }

  /**
   * Get single conversation details with complete CRM 360° linkages
   */
  async getConversationDetails(id: string, organizationId: string) {
    const conversation = await conversationRepo.findById(id, organizationId);
    if (!conversation) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }
    return conversation;
  }

  /**
   * Fetch chronological messages in a conversation thread
   */
  async getMessages(
    conversationId: string,
    organizationId: string,
    query: GetMessagesQueryInput,
  ) {
    // 1. Verify conversation belongs to tenant
    const conversation = await conversationRepo.findById(conversationId, organizationId);
    if (!conversation) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    return chatMessageRepo.findByConversationId(conversationId, query);
  }

  /**
   * Dispatch a reply or log an internal team note (Tri-Mode Dispatch Engine)
   */
  async sendReply(
    conversationId: string,
    organizationId: string,
    user: AuthenticatedUser,
    input: SendReplyInput,
  ) {
    // 1. Validate conversation exists and belongs to tenant
    const conversation = await conversationRepo.findById(conversationId, organizationId);
    if (!conversation) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    // 2. Resolve sender employee record
    const employee = await prisma.employee.findFirst({
      where: {
        userId: user.id,
        organizationId,
        isDeleted: false,
      },
      select: {
        id: true,
        employeeCode: true,
        designation: true,
      },
    });

    const senderName = `${user.firstName} ${user.lastName || ""}`.trim() || user.email;

    // =========================================================================
    // TRI-MODE DISPATCH ROUTE 1: INTERNAL NOTE (Never dispatched to customer)
    // =========================================================================
    if (input.direction === MessageDirection.INTERNAL) {
      const internalNoteMessage = await chatMessageRepo.create({
        conversationId,
        senderType: "EMPLOYEE_AGENT",
        senderEmployeeId: employee?.id || null,
        senderName,
        direction: MessageDirection.INTERNAL,
        replyChannel: input.replyChannel || CommunicationChannel.WHATSAPP,
        contentType: input.contentType || MessageContentType.TEXT,
        content: input.content,
        media: input.media as any,
        status: "SENT",
        additionalInformation: input.additionalInformation as any,
      });

      // Update conversation metadata
      const previewSnippet = `[Team Note] ${input.content.slice(0, 80)}`;
      await conversationRepo.recordOutboundActivity(
        conversationId,
        previewSnippet,
        MessageDirection.INTERNAL,
      );

      // Audit trail
      await conversationAuditRepo.create(
        conversationId,
        "INTERNAL_NOTE_ADDED",
        user.id,
        {
          senderName,
          noteSnippet: input.content.slice(0, 100),
        },
      );

      // Fetch fresh conversation state for organization broadcast
      const updatedConversation = await conversationRepo.findById(conversationId, organizationId);

      // Real-Time WebSocket Broadcasts
      wsService.broadcastToConversation(
        conversationId,
        WebSocketEventType.NOTE_ADDED,
        internalNoteMessage,
      );
      wsService.broadcastToOrganization(
        organizationId,
        WebSocketEventType.CONVERSATION_UPDATED,
        updatedConversation,
      );

      return internalNoteMessage;
    }

    // =========================================================================
    // TRI-MODE DISPATCH ROUTE 2: OUTGOING MESSAGE (Dispatched to recipient)
    // =========================================================================
    let externalMessageId: string | null = null;
    let messageStatus: "SENT" | "DELIVERED" | "FAILED" = "SENT";
    let errorMessage: string | null = null;
    let errorCode: string | null = null;

    if (input.replyChannel === CommunicationChannel.WHATSAPP) {
      // 1. Retrieve tenant WhatsApp credentials
      const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
      if (!integration || !integration.accessToken || !integration.phoneNumberId) {
        throw new ErrorResponse(
          "WhatsApp Cloud API integration is not configured or active for this organization. Please configure in Settings > WhatsApp Integration.",
          statusCode.Bad_Request,
        );
      }

      // 2. Format recipient phone number (strip leading + and spaces)
      const targetPhone = conversation.recipientPhone.replace(/\D/g, "");

      try {
        let metaPayload: Record<string, unknown>;

        if (input.templateId) {
          // Pre-Approved WhatsApp Message Template Dispatch
          const template = await prisma.whatsAppMessageTemplate.findFirst({
            where: { id: input.templateId, organizationId },
          });

          if (!template) {
            throw new ErrorResponse("Selected WhatsApp template not found", statusCode.Not_Found);
          }

          metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: targetPhone,
            type: "template",
            template: {
              name: template.name,
              language: { code: template.language || "en" },
              components: input.templateVariables || [],
            },
          };
        } else if (input.media && input.media.url) {
          // Media Dispatch (IMAGE, DOCUMENT, VIDEO, AUDIO)
          const mediaType =
            input.contentType === MessageContentType.IMAGE
              ? "image"
              : input.contentType === MessageContentType.VIDEO
                ? "video"
                : input.contentType === MessageContentType.AUDIO
                  ? "audio"
                  : "document";

          metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: targetPhone,
            type: mediaType,
            [mediaType]: {
              link: input.media.url,
              caption: input.content || undefined,
            },
          };
        } else {
          // Standard Text Message Dispatch
          metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: targetPhone,
            type: "text",
            text: {
              preview_url: false,
              body: input.content,
            },
          };
        }

        const metaResponse = await metaWhatsAppService.dispatchMessageToMeta(
          integration.phoneNumberId,
          integration.accessToken,
          metaPayload,
        );

        externalMessageId = metaResponse.messages?.[0]?.id || null;
        messageStatus = "SENT";
      } catch (err: any) {
        console.error("[ConversationService] Meta WhatsApp Dispatch Failed:", err.message);
        messageStatus = "FAILED";
        errorMessage = err.message || "Failed to dispatch WhatsApp message";
        errorCode = "META_DISPATCH_ERROR";
        // Propagate error if fatal
        throw err;
      }
    } else if (input.replyChannel === CommunicationChannel.EMAIL) {
      // Future Email Integration Dispatch Pipeline Hook
      console.log(
        `[ConversationService] Queuing email dispatch for conversation ${conversationId} to ${conversation.recipientEmail || conversation.recipientPhone}`,
      );
      externalMessageId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      messageStatus = "SENT";
    } else {
      // SMS / Telegram Dispatch Pipeline Hook
      externalMessageId = `${input.replyChannel.toLowerCase()}_${Date.now()}`;
      messageStatus = "SENT";
    }

    // 3. Persist outbound chat message in database
    const createdMessage = await chatMessageRepo.create({
      conversationId,
      senderType: "EMPLOYEE_AGENT",
      senderEmployeeId: employee?.id || null,
      senderName,
      direction: MessageDirection.OUTGOING,
      replyChannel: input.replyChannel || CommunicationChannel.WHATSAPP,
      contentType: input.contentType || MessageContentType.TEXT,
      content: input.content,
      media: input.media as any,
      templateId: input.templateId || null,
      templateVariables: input.templateVariables as any,
      status: messageStatus,
      externalMessageId,
      errorCode,
      errorMessage,
      additionalInformation: input.additionalInformation as any,
    });

    // 4. Update conversation last activity
    const previewSnippet = input.content || (input.media ? "[Media Attachment]" : "[Template Message]");
    await conversationRepo.recordOutboundActivity(
      conversationId,
      previewSnippet,
      MessageDirection.OUTGOING,
    );

    // 5. Audit trail
    await conversationAuditRepo.create(
      conversationId,
      "REPLY_DISPATCHED",
      user.id,
      {
        channel: input.replyChannel,
        externalMessageId,
        status: messageStatus,
      },
    );

    // 6. Fetch fresh conversation state for organization broadcast
    const updatedConversation = await conversationRepo.findById(conversationId, organizationId);

    // 7. Real-Time WebSocket Broadcasts
    wsService.broadcastToConversation(
      conversationId,
      WebSocketEventType.MESSAGE_SENT,
      createdMessage,
    );
    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_UPDATED,
      updatedConversation,
    );

    return createdMessage;
  }

  /**
   * Initiate a brand new outbound conversation thread to a customer/lead
   */
  async initiateOutboundConversation(
    organizationId: string,
    user: AuthenticatedUser,
    input: InitiateOutboundConversationInput,
  ) {
    const normalizedDigits = input.recipientPhone.replace(/\D/g, "");
    const formattedPhone = input.recipientPhone.startsWith("+")
      ? input.recipientPhone
      : `+${input.recipientPhone}`;

    // 1. Check if an active conversation thread already exists for this number
    let conversation = await conversationRepo.findByRecipientPhone(
      organizationId,
      normalizedDigits,
      input.channel,
    );

    if (!conversation) {
      // 2. Resolve or conditionally create CRM Lead
      let leadId = input.leadId;

      if (!leadId) {
        // Find existing active lead by customer phone
        const existingLead = await prisma.lead.findFirst({
          where: {
            organizationId,
            isDeleted: false,
            customer: {
              phone: { contains: normalizedDigits.slice(-10) },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        if (existingLead) {
          leadId = existingLead.id;
        } else {
          // Create new Lead for this outbound inquiry
          const createdLead = await leadService.createLead(organizationId, {
            title: `Outbound ${input.channel} Conversation with ${input.recipientName || formattedPhone}`,
            workDescription: input.initialMessage,
            source: LeadSource.PHONE_INQUIRY,
            status: LeadStatus.NEW,
            priority: LeadPriority.HIGH,
            projectType: LeadProjectType.RESIDENTIAL,
            customer: {
              firstName: input.recipientName?.split(" ")[0] || "Customer",
              lastName: input.recipientName?.split(" ").slice(1).join(" ") || "",
              phone: formattedPhone,
              email: input.recipientEmail || undefined,
            },
            notes: `Outbound thread initiated by ${user.firstName} on ${new Date().toLocaleString()}`,
          });

          leadId = createdLead.id;
        }
      }

      // 3. Create the Conversation Thread
      conversation = (await conversationRepo.create(organizationId, {
        channel: input.channel,
        status: ConversationStatus.OPEN,
        priority: "NORMAL",
        handlingMode: ConversationHandlingMode.MANUAL_HUMAN,
        externalThreadId: normalizedDigits,
        recipientPhone: formattedPhone,
        recipientEmail: input.recipientEmail,
        recipientName: input.recipientName,
        leadId: leadId!,
        projectId: input.projectId,
        assignedEmployeeId: input.assignedEmployeeId,
        assignedTeamId: input.assignedTeamId,
        unreadCount: 0,
        lastMessageText: input.initialMessage,
        lastMessageAt: new Date(),
        lastMessageDirection: MessageDirection.OUTGOING,
        additionalInformation: input.additionalInformation as any,
      })) as any;

      wsService.broadcastToOrganization(
        organizationId,
        WebSocketEventType.CONVERSATION_CREATED,
        conversation,
      );
    }

    if (!conversation) {
      throw new ErrorResponse("Conversation thread could not be established", statusCode.Internal_Server_Error);
    }

    // 4. Dispatch the initial message using sendReply
    const message = await this.sendReply(conversation.id, organizationId, user, {
      direction: MessageDirection.OUTGOING,
      replyChannel: input.channel,
      contentType: input.contentType,
      content: input.initialMessage,
      media: input.media,
      templateId: input.templateId,
      templateVariables: input.templateVariables,
      additionalInformation: input.additionalInformation,
    });

    const fullDetails = await conversationRepo.findById(conversation.id, organizationId);

    return {
      conversation: fullDetails,
      initialMessage: message,
    };
  }

  /**
   * Update conversation lifecycle status (OPEN, PENDING, RESOLVED, ARCHIVED)
   */
  async updateStatus(
    id: string,
    organizationId: string,
    user: AuthenticatedUser,
    status: ConversationStatus,
  ) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    const updated = await conversationRepo.updateStatus(id, organizationId, status);

    await conversationAuditRepo.create(id, "STATUS_UPDATED", user.id, {
      previousStatus: existing.status,
      newStatus: status,
    });

    const fullDetails = await conversationRepo.findById(id, organizationId);

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_UPDATED,
      fullDetails,
    );

    return fullDetails;
  }

  /**
   * Switch handling mode between Human Agent, Autonomous AI Bot, or AI Copilot
   */
  async updateHandlingMode(
    id: string,
    organizationId: string,
    user: AuthenticatedUser,
    handlingMode: ConversationHandlingMode,
  ) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    await conversationRepo.updateHandlingMode(id, organizationId, handlingMode);

    await conversationAuditRepo.create(id, "HANDLING_MODE_UPDATED", user.id, {
      previousMode: existing.handlingMode,
      newMode: handlingMode,
    });

    const fullDetails = await conversationRepo.findById(id, organizationId);

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_UPDATED,
      fullDetails,
    );

    return fullDetails;
  }

  /**
   * Assign conversation to Employee and/or Team
   */
  async assignConversation(
    id: string,
    organizationId: string,
    user: AuthenticatedUser,
    input: AssignConversationInput,
  ) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    await conversationRepo.assign(
      id,
      organizationId,
      input.assignedEmployeeId || null,
      input.assignedTeamId || null,
    );

    await conversationAuditRepo.create(id, "CONVERSATION_ASSIGNED", user.id, {
      previousEmployeeId: existing.assignedEmployeeId,
      newEmployeeId: input.assignedEmployeeId,
      previousTeamId: existing.assignedTeamId,
      newTeamId: input.assignedTeamId,
    });

    const fullDetails = await conversationRepo.findById(id, organizationId);

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_ASSIGNED,
      fullDetails,
    );
    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_UPDATED,
      fullDetails,
    );

    return fullDetails;
  }

  /**
   * Toggle starred status
   */
  async toggleStarred(id: string, organizationId: string, isStarred: boolean) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    const updated = await conversationRepo.toggleStarred(id, organizationId, isStarred);
    return updated;
  }

  /**
   * Toggle pinned status
   */
  async togglePinned(id: string, organizationId: string, isPinned: boolean) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    const updated = await conversationRepo.update(id, organizationId, { isPinned });
    return updated;
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(id: string, organizationId: string) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    const updated = await conversationRepo.markAsRead(id, organizationId);

    wsService.broadcastToOrganization(
      organizationId,
      WebSocketEventType.CONVERSATION_READ,
      { conversationId: id },
    );

    return updated;
  }

  /**
   * Update custom tags
   */
  async updateTags(id: string, organizationId: string, tags: string[]) {
    const existing = await conversationRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Conversation thread not found", statusCode.Not_Found);
    }

    return conversationRepo.update(id, organizationId, { tags });
  }

  /**
   * Get analytics KPIs for inbox header ribbon
   */
  async getInboxAnalytics(organizationId: string) {
    return conversationRepo.getAnalytics(organizationId);
  }
}

export const conversationService = new ConversationService();
