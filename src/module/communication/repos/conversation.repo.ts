import { prisma } from "../../../lib/prisma.js";
import {
  Prisma,
  type CommunicationChannel,
  type ConversationStatus,
  type ConversationPriority,
  type ConversationHandlingMode,
  type MessageDirection,
} from "../../../types/types.js";

export interface ConversationListQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  tab?:
    | "all"
    | "unread"
    | "starred"
    | "assigned_to_me"
    | "open"
    | "pending"
    | "resolved"
    | "archived";
  channel?: CommunicationChannel;
  status?: ConversationStatus;
  priority?: ConversationPriority;
  handlingMode?: ConversationHandlingMode;
  assignedEmployeeId?: string;
  assignedTeamId?: string;
  currentUserId?: string;
  leadId?: string;
  projectId?: string;
  isStarred?: boolean;
}

/**
 * Repository handling database operations for omnichannel Conversation threads
 */
export class ConversationRepository {
  /**
   * Find paginated list of conversations scoped to tenant organization
   * @param organizationId Tenant organization UUID
   * @param options Query filters, tabs, search, and pagination
   */
  async findAll(organizationId: string, options: ConversationListQueryOptions = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      organizationId,
      isDeleted: false,
    };

    // Filter by tab presets
    if (options.tab) {
      switch (options.tab) {
        case "unread":
          where.unreadCount = { gt: 0 };
          break;
        case "starred":
          where.isStarred = true;
          break;
        case "assigned_to_me":
          if (options.assignedEmployeeId) {
            where.assignedEmployeeId = options.assignedEmployeeId;
          } else if (options.currentUserId) {
            where.assignedEmployee = { userId: options.currentUserId };
          }
          break;
        case "open":
          where.status = "OPEN";
          break;
        case "pending":
          where.status = "PENDING";
          break;
        case "resolved":
          where.status = "RESOLVED";
          break;
        case "archived":
          where.status = "ARCHIVED";
          break;
        case "all":
        default:
          break;
      }
    }

    // Direct filters
    if (options.channel) where.channel = options.channel;
    if (options.status && !options.tab) where.status = options.status;
    if (options.priority) where.priority = options.priority;
    if (options.handlingMode) where.handlingMode = options.handlingMode;
    if (options.assignedEmployeeId && options.tab !== "assigned_to_me") {
      where.assignedEmployeeId = options.assignedEmployeeId;
    }
    if (options.assignedTeamId) where.assignedTeamId = options.assignedTeamId;
    if (options.leadId) where.leadId = options.leadId;
    if (options.projectId) where.projectId = options.projectId;
    if (typeof options.isStarred === "boolean" && options.tab !== "starred") {
      where.isStarred = options.isStarred;
    }

    // Full-text / substring search across recipient identity, message preview, tags, and lead
    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      where.OR = [
        { recipientName: { contains: q, mode: "insensitive" } },
        { recipientPhone: { contains: q, mode: "insensitive" } },
        { recipientEmail: { contains: q, mode: "insensitive" } },
        { lastMessageText: { contains: q, mode: "insensitive" } },
        { tags: { has: q } },
        {
          lead: {
            OR: [
              { leadCode: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              {
                customer: {
                  OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { displayName: { contains: q, mode: "insensitive" } },
                    { phone: { contains: q, mode: "insensitive" } },
                  ],
                },
              },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isPinned: "desc" }, { lastMessageAt: "desc" }],
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              projectType: true,
              priority: true,
              estimatedBudget: true,
              customer: {
                select: {
                  id: true,
                  customerCode: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  phone: true,
                  email: true,
                  avatarUrl: true,
                },
              },
            },
          },
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
            },
          },
          assignedEmployee: {
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
                  phone: true,
                },
              },
            },
          },
          assignedTeam: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
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
   * Find single conversation by ID with rich relation trees
   * @param id Conversation UUID
   * @param organizationId Tenant organization UUID
   */
  async findById(id: string, organizationId: string) {
    return prisma.conversation.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        lead: {
          include: {
            customer: true,
            assignedTo: {
              include: { user: true },
            },
          },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
          },
        },
        assignedEmployee: {
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
                phone: true,
              },
            },
          },
        },
        assignedTeam: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        auditLogs: {
          take: 15,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Find active conversation thread by external identity (e.g. WhatsApp wa_id)
   */
  async findByExternalThread(
    organizationId: string,
    channel: CommunicationChannel,
    externalThreadId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.findFirst({
      where: {
        organizationId,
        channel,
        externalThreadId,
        isDeleted: false,
      },
      include: {
        lead: {
          include: { customer: true },
        },
      },
    });
  }

  /**
   * Find active conversation by recipient phone number in organization
   */
  async findByRecipientPhone(
    organizationId: string,
    recipientPhone: string,
    channel: CommunicationChannel = "WHATSAPP",
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const normalizedDigits = recipientPhone.replace(/\D/g, "").slice(-10);

    return db.conversation.findFirst({
      where: {
        organizationId,
        channel,
        isDeleted: false,
        recipientPhone: {
          contains: normalizedDigits,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        lead: {
          include: { customer: true },
        },
      },
    });
  }

  /**
   * Create a new Conversation thread
   */
  async create(
    organizationId: string,
    data: {
      channel?: CommunicationChannel;
      status?: ConversationStatus;
      priority?: ConversationPriority;
      handlingMode?: ConversationHandlingMode;
      externalThreadId?: string | null;
      recipientPhone: string;
      recipientEmail?: string | null;
      recipientName?: string | null;
      leadId: string;
      projectId?: string | null;
      assignedEmployeeId?: string | null;
      assignedTeamId?: string | null;
      unreadCount?: number;
      lastMessageText?: string | null;
      lastMessageAt?: Date;
      lastMessageDirection?: MessageDirection;
      tags?: string[];
      additionalInformation?: Prisma.InputJsonValue;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.create({
      data: {
        organizationId,
        channel: data.channel || "WHATSAPP",
        status: data.status || "OPEN",
        priority: data.priority || "NORMAL",
        handlingMode: data.handlingMode || "MANUAL_HUMAN",
        externalThreadId: data.externalThreadId,
        recipientPhone: data.recipientPhone,
        recipientEmail: data.recipientEmail,
        recipientName: data.recipientName,
        leadId: data.leadId,
        projectId: data.projectId,
        assignedEmployeeId: data.assignedEmployeeId,
        assignedTeamId: data.assignedTeamId,
        unreadCount: data.unreadCount ?? 0,
        lastMessageText: data.lastMessageText,
        lastMessageAt: data.lastMessageAt || new Date(),
        lastMessageDirection: data.lastMessageDirection || "INCOMING",
        tags: data.tags || [],
        additionalInformation: data.additionalInformation ?? Prisma.JsonNull,
      },
      include: {
        lead: {
          include: { customer: true },
        },
        assignedEmployee: {
          include: { user: true },
        },
      },
    });
  }

  /**
   * Update conversation attributes
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.ConversationUpdateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data,
      include: {
        lead: {
          include: { customer: true },
        },
        assignedEmployee: {
          include: { user: true },
        },
        assignedTeam: true,
      },
    });
  }

  /**
   * Update conversation status (OPEN, PENDING, RESOLVED, ARCHIVED)
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: ConversationStatus,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data: { status },
    });
  }

  /**
   * Update conversation AI / Human handling mode
   */
  async updateHandlingMode(
    id: string,
    organizationId: string,
    handlingMode: ConversationHandlingMode,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data: { handlingMode },
    });
  }

  /**
   * Assign conversation to Employee and/or Team
   */
  async assign(
    id: string,
    organizationId: string,
    assignedEmployeeId: string | null,
    assignedTeamId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data: {
        assignedEmployeeId,
        assignedTeamId,
      },
      include: {
        assignedEmployee: {
          include: { user: true },
        },
        assignedTeam: true,
      },
    });
  }

  /**
   * Toggle star/favorite status
   */
  async toggleStarred(
    id: string,
    organizationId: string,
    isStarred: boolean,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data: { isStarred },
    });
  }

  /**
   * Mark conversation as read (resets unreadCount to 0)
   */
  async markAsRead(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id, organizationId },
      data: { unreadCount: 0 },
    });
  }

  /**
   * Increment unread count and update last message timestamp & preview
   */
  async recordInboundMessage(
    id: string,
    lastMessageText: string,
    lastMessageAt: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id },
      data: {
        lastMessageText,
        lastMessageAt,
        lastMessageDirection: "INCOMING",
        unreadCount: { increment: 1 },
      },
    });
  }

  /**
   * Update conversation after outbound message or internal note dispatch
   */
  async recordOutboundActivity(
    id: string,
    lastMessageText: string,
    direction: MessageDirection,
    lastMessageAt: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversation.update({
      where: { id },
      data: {
        lastMessageText,
        lastMessageAt,
        lastMessageDirection: direction,
      },
    });
  }

  /**
   * Aggregated KPI analytics for Inbox dashboard ribbon
   */
  async getAnalytics(organizationId: string) {
    const where: Prisma.ConversationWhereInput = {
      organizationId,
      isDeleted: false,
    };

    const [
      totalCount,
      unreadCount,
      starredCount,
      openCount,
      pendingCount,
      resolvedCount,
      archivedCount,
      aiAutonomousCount,
      whatsappCount,
      emailCount,
    ] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...where, unreadCount: { gt: 0 } } }),
      prisma.conversation.count({ where: { ...where, isStarred: true } }),
      prisma.conversation.count({ where: { ...where, status: "OPEN" } }),
      prisma.conversation.count({ where: { ...where, status: "PENDING" } }),
      prisma.conversation.count({ where: { ...where, status: "RESOLVED" } }),
      prisma.conversation.count({ where: { ...where, status: "ARCHIVED" } }),
      prisma.conversation.count({ where: { ...where, handlingMode: "AI_AUTONOMOUS" } }),
      prisma.conversation.count({ where: { ...where, channel: "WHATSAPP" } }),
      prisma.conversation.count({ where: { ...where, channel: "EMAIL" } }),
    ]);

    return {
      total: totalCount,
      unread: unreadCount,
      starred: starredCount,
      open: openCount,
      pending: pendingCount,
      resolved: resolvedCount,
      archived: archivedCount,
      aiAutonomous: aiAutonomousCount,
      whatsapp: whatsappCount,
      email: emailCount,
    };
  }
}

export const conversationRepo = new ConversationRepository();
