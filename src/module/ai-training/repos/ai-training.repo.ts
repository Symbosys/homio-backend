import { prisma } from "../../../lib/prisma.js";
import {
  AiSourceType,
  AiIngestionStatus,
  Prisma,
} from "../../../types/types.js";

/**
 * AI Training Repository
 * Handles all database persistence and multi-tenant queries for the AI Training & Knowledge Studio.
 */
export class AiTrainingRepository {
  /**
   * --- KNOWLEDGE SOURCES ---
   */

  async findSources(
    organizationId: string,
    params: {
      type?: AiSourceType;
      status?: AiIngestionStatus;
      leadFunnelId?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AiKnowledgeSourceWhereInput = {
      organizationId,
      isDeleted: false,
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.leadFunnelId && params.leadFunnelId !== "ALL" && params.leadFunnelId !== "all" && {
        leadFunnelId: params.leadFunnelId === "UNIVERSAL" || params.leadFunnelId === "null" ? null : params.leadFunnelId,
      }),
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: "insensitive" } },
          { description: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.aiKnowledgeSource.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          leadFunnel: {
            select: {
              id: true,
              name: true,
              slug: true,
              color: true,
              funnelCategory: true,
            },
          },
          _count: {
            select: {
              chunks: true,
              faqs: true,
            },
          },
        },
      }),
      prisma.aiKnowledgeSource.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findSourceById(organizationId: string, id: string) {
    return prisma.aiKnowledgeSource.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        leadFunnel: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            funnelCategory: true,
          },
        },
        _count: {
          select: {
            chunks: true,
            faqs: true,
          },
        },
      },
    });
  }

  async createSource(organizationId: string, data: Prisma.AiKnowledgeSourceUncheckedCreateInput) {
    return prisma.aiKnowledgeSource.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  async updateSource(
    organizationId: string,
    id: string,
    data: Prisma.AiKnowledgeSourceUncheckedUpdateInput,
  ) {
    return prisma.aiKnowledgeSource.update({
      where: { id },
      data,
    });
  }

  async softDeleteSource(organizationId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      // Soft delete source
      const deletedSource = await tx.aiKnowledgeSource.update({
        where: { id },
        data: {
          isDeleted: true,
          status: AiIngestionStatus.FAILED,
        },
      });

      // Deactivate associated chunks
      await tx.aiKnowledgeChunk.updateMany({
        where: {
          organizationId,
          knowledgeSourceId: id,
        },
        data: {
          isActive: false,
        },
      });

      return deletedSource;
    });
  }

  /**
   * --- KNOWLEDGE CHUNKS ---
   */

  async findChunksBySource(
    organizationId: string,
    knowledgeSourceId: string,
    params: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.AiKnowledgeChunkWhereInput = {
      organizationId,
      knowledgeSourceId,
      isActive: true,
    };

    const [items, total] = await Promise.all([
      prisma.aiKnowledgeChunk.findMany({
        where,
        skip,
        take: limit,
        orderBy: { chunkIndex: "asc" },
        select: {
          id: true,
          organizationId: true,
          knowledgeSourceId: true,
          chunkIndex: true,
          chunkText: true,
          tokenCount: true,
          embeddingDimensions: true,
          embeddingProvider: true,
          embeddingModelKey: true,
          chunkMetadata: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.aiKnowledgeChunk.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * --- KNOWLEDGE FAQS ---
   */

  async findFaqs(
    organizationId: string,
    params: {
      knowledgeSourceId?: string;
      category?: string;
      search?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AiKnowledgeFaqWhereInput = {
      organizationId,
      ...(params.knowledgeSourceId && { knowledgeSourceId: params.knowledgeSourceId }),
      ...(params.category && { category: params.category }),
      ...(params.search && {
        OR: [
          { question: { contains: params.search, mode: "insensitive" } },
          { answer: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.aiKnowledgeFaq.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          knowledgeSource: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
      }),
      prisma.aiKnowledgeFaq.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFaqById(organizationId: string, id: string) {
    return prisma.aiKnowledgeFaq.findFirst({
      where: {
        id,
        organizationId,
      },
    });
  }

  async createFaq(organizationId: string, data: Prisma.AiKnowledgeFaqUncheckedCreateInput) {
    return prisma.aiKnowledgeFaq.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  async updateFaq(
    organizationId: string,
    id: string,
    data: Prisma.AiKnowledgeFaqUncheckedUpdateInput,
  ) {
    return prisma.aiKnowledgeFaq.update({
      where: { id },
      data,
    });
  }

  async deleteFaq(organizationId: string, id: string) {
    return prisma.aiKnowledgeFaq.delete({
      where: { id },
    });
  }

  /**
   * --- GOLDEN CONVERSATIONS & TURNS ---
   */

  async findGoldenConversations(
    organizationId: string,
    params: { search?: string; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AiGoldenConversationWhereInput = {
      organizationId,
      ...(params.search && {
        OR: [
          { title: { contains: params.search, mode: "insensitive" } },
          { scenario: { contains: params.search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.aiGoldenConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          turns: {
            orderBy: { turnOrder: "asc" },
          },
        },
      }),
      prisma.aiGoldenConversation.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findGoldenConversationById(organizationId: string, id: string) {
    return prisma.aiGoldenConversation.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        turns: {
          orderBy: { turnOrder: "asc" },
        },
      },
    });
  }

  async createGoldenConversation(
    organizationId: string,
    data: {
      title?: string;
      scenario: string;
      category?: string;
      additionalInformation?: any;
      turns: Array<{
        role: any;
        content: string;
        turnOrder: number;
        additionalInformation?: any;
      }>;
    },
  ) {
    return prisma.aiGoldenConversation.create({
      data: {
        organizationId,
        title: data.title || "Golden Exemplar",
        scenario: data.scenario,
        category: data.category || "Lead Qualification",
        additionalInformation: data.additionalInformation ?? Prisma.DbNull,
        turns: {
          create: data.turns.map((t) => ({
            role: t.role,
            content: t.content,
            turnOrder: t.turnOrder,
            additionalInformation: t.additionalInformation ?? Prisma.DbNull,
          })),
        },
      },
      include: {
        turns: {
          orderBy: { turnOrder: "asc" },
        },
      },
    });
  }

  async updateGoldenConversation(
    organizationId: string,
    id: string,
    data: {
      title?: string;
      scenario?: string;
      category?: string;
      isActive?: boolean;
      additionalInformation?: any;
      turns?: Array<{
        role: any;
        content: string;
        turnOrder: number;
        additionalInformation?: any;
      }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      if (data.turns) {
        // Replace existing turns
        await tx.aiGoldenTurn.deleteMany({
          where: { conversationId: id },
        });

        await tx.aiGoldenTurn.createMany({
          data: data.turns.map((t) => ({
            conversationId: id,
            role: t.role,
            content: t.content,
            turnOrder: t.turnOrder,
            additionalInformation: t.additionalInformation ?? Prisma.DbNull,
          })),
        });
      }

      return tx.aiGoldenConversation.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.scenario !== undefined && { scenario: data.scenario }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.additionalInformation !== undefined && {
            additionalInformation: data.additionalInformation ?? Prisma.DbNull,
          }),
        },
        include: {
          turns: {
            orderBy: { turnOrder: "asc" },
          },
        },
      });
    });
  }

  async deleteGoldenConversation(organizationId: string, id: string) {
    return prisma.aiGoldenConversation.delete({
      where: { id },
    });
  }

  /**
   * --- GUARDRAILS ---
   */

  async findGuardrailConfig(organizationId: string) {
    return prisma.aiGuardrailConfig.findUnique({
      where: { organizationId },
    });
  }

  async upsertGuardrailConfig(
    organizationId: string,
    data: Prisma.AiGuardrailConfigUncheckedCreateInput,
  ) {
    return prisma.aiGuardrailConfig.upsert({
      where: { organizationId },
      create: {
        ...data,
        organizationId,
      },
      update: data,
    });
  }

  /**
   * --- VERSION HISTORY & METRICS ---
   */

  async findVersions(
    organizationId: string,
    params: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, Math.min(100, params.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.aiTrainingVersion.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.aiTrainingVersion.count({ where: { organizationId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMetrics(organizationId: string) {
    const [
      totalSources,
      indexedSources,
      failedSources,
      totalChunks,
      totalFaqs,
      totalGoldenConversations,
      guardrailConfig,
      latestVersion,
    ] = await Promise.all([
      prisma.aiKnowledgeSource.count({ where: { organizationId, isDeleted: false } }),
      prisma.aiKnowledgeSource.count({
        where: { organizationId, status: AiIngestionStatus.INDEXED, isDeleted: false },
      }),
      prisma.aiKnowledgeSource.count({
        where: { organizationId, status: AiIngestionStatus.FAILED, isDeleted: false },
      }),
      prisma.aiKnowledgeChunk.count({ where: { organizationId, isActive: true } }),
      prisma.aiKnowledgeFaq.count({ where: { organizationId, isActive: true } }),
      prisma.aiGoldenConversation.count({ where: { organizationId, isActive: true } }),
      prisma.aiGuardrailConfig.findUnique({ where: { organizationId } }),
      prisma.aiTrainingVersion.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return {
      totalSources,
      indexedSources,
      failedSources,
      totalChunks,
      totalFaqs,
      totalGoldenConversations,
      hasGuardrails: !!guardrailConfig,
      latestVersion: latestVersion?.versionTag || "v1.0.0",
      lastTrainedAt: latestVersion?.deployedAt || null,
    };
  }
}

export const aiTrainingRepository = new AiTrainingRepository();
