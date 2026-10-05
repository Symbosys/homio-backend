import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";

export class ConversationAuditRepository {
  /**
   * Record an action in the conversation audit trail
   */
  async create(
    conversationId: string,
    action: string,
    performedBy?: string | null,
    details?: Record<string, unknown> | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    return db.conversationAuditLog.create({
      data: {
        conversationId,
        action,
        performedBy,
        details: details ? (details as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  /**
   * Fetch audit logs for a conversation
   */
  async findByConversationId(conversationId: string, limit: number = 20) {
    return prisma.conversationAuditLog.findMany({
      where: { conversationId },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }
}

export const conversationAuditRepo = new ConversationAuditRepository();
