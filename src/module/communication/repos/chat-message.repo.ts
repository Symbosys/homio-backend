import { prisma } from "../../../lib/prisma.js";
import {
  Prisma,
  type MessageDirection,
  type CommunicationChannel,
  type MessageContentType,
  type MessageSenderType,
  type MessageStatus,
} from "../../../types/types.js";

export interface ChatMessageListOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  direction?: MessageDirection;
  replyChannel?: CommunicationChannel;
  contentType?: MessageContentType;
}

export class ChatMessageRepository {
  /**
   * Create a new chat message in a conversation thread
   */
  async create(
    data: {
      conversationId: string;
      senderType?: MessageSenderType;
      senderEmployeeId?: string | null;
      senderName?: string | null;
      direction: MessageDirection;
      replyChannel?: CommunicationChannel;
      contentType?: MessageContentType;
      content: string;
      media?: Prisma.InputJsonValue;
      templateId?: string | null;
      templateVariables?: Prisma.InputJsonValue;
      status?: MessageStatus;
      externalMessageId?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
      deliveredAt?: Date | null;
      readAt?: Date | null;
      aiGenerated?: boolean;
      aiConfidence?: number | null;
      aiPromptTokens?: number | null;
      aiCompletionTokens?: number | null;
      metadata?: Prisma.InputJsonValue;
      additionalInformation?: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.chatMessage.create({
      data: {
        conversationId: data.conversationId,
        senderType: data.senderType || (data.direction === "INCOMING" ? "CUSTOMER" : "EMPLOYEE_AGENT"),
        senderEmployeeId: data.senderEmployeeId,
        senderName: data.senderName,
        direction: data.direction,
        replyChannel: data.replyChannel || "WHATSAPP",
        contentType: data.contentType || "TEXT",
        content: data.content,
        media: data.media ?? Prisma.JsonNull,
        templateId: data.templateId,
        templateVariables: data.templateVariables ?? Prisma.JsonNull,
        status: data.status || "SENT",
        externalMessageId: data.externalMessageId,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        deliveredAt: data.deliveredAt,
        readAt: data.readAt,
        aiGenerated: data.aiGenerated ?? false,
        aiConfidence: data.aiConfidence,
        aiPromptTokens: data.aiPromptTokens,
        aiCompletionTokens: data.aiCompletionTokens,
        metadata: data.metadata ?? Prisma.JsonNull,
        additionalInformation: data.additionalInformation ?? Prisma.JsonNull,
      },
      include: {
        senderEmployee: {
          select: {
            id: true,
            employeeCode: true,
            designation: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        template: {
          select: {
            id: true,
            name: true,
            category: true,
            language: true,
          },
        },
      },
    });
  }

  /**
   * Fetch chronological messages in a conversation thread with pagination
   */
  async findByConversationId(conversationId: string, options: ChatMessageListOptions = {}) {
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    const page = Math.max(1, Number(options.page) || 1);
    const skip = (page - 1) * limit;

    const where: Prisma.ChatMessageWhereInput = {
      conversationId,
    };

    if (options.direction) where.direction = options.direction;
    if (options.replyChannel) where.replyChannel = options.replyChannel;
    if (options.contentType) where.contentType = options.contentType;

    const [items, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" },
        include: {
          senderEmployee: {
            select: {
              id: true,
              employeeCode: true,
              designation: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          template: {
            select: {
              id: true,
              name: true,
              category: true,
              language: true,
            },
          },
        },
      }),
      prisma.chatMessage.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Find single message by ID
   */
  async findById(id: string) {
    return prisma.chatMessage.findUnique({
      where: { id },
      include: {
        conversation: true,
        senderEmployee: {
          include: { user: true },
        },
      },
    });
  }

  /**
   * Find single message by external message ID (e.g. Meta wamid)
   */
  async findByExternalMessageId(externalMessageId: string) {
    return prisma.chatMessage.findFirst({
      where: { externalMessageId },
      include: { conversation: true },
    });
  }

  /**
   * Update message delivery/read lifecycle status matching external provider ID
   */
  async updateStatusByExternalId(
    externalMessageId: string,
    status: MessageStatus,
    timestamps?: { deliveredAt?: Date; readAt?: Date },
    errorDetails?: { errorCode?: string; errorMessage?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const data: Prisma.ChatMessageUpdateInput = { status };

    if (timestamps?.deliveredAt) data.deliveredAt = timestamps.deliveredAt;
    if (timestamps?.readAt) data.readAt = timestamps.readAt;
    if (errorDetails?.errorCode) data.errorCode = errorDetails.errorCode;
    if (errorDetails?.errorMessage) data.errorMessage = errorDetails.errorMessage;

    return db.chatMessage.updateMany({
      where: { externalMessageId },
      data,
    });
  }
}

export const chatMessageRepo = new ChatMessageRepository();
