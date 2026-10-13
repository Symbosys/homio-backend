import { prisma } from "../../../lib/prisma.js";
import {
  AiServiceType,
  AiSessionStatus,
  AiTransactionType,
  AiChatMessageSender,
} from "../../../types/types.js";
import type {
  CreateDoubtSolverSessionInput,
  QueryDoubtSolverSessionsInput,
  UpdateDoubtSolverSessionInput,
} from "../validators/doubt-solver.validator.js";

export class DoubtSolverRepository {
  /**
   * Fetch active credit pricing rate for Doubt Solver
   */
  public async getDoubtSolverServiceRate() {
    return prisma.aiServiceRate.findUnique({
      where: { serviceType: AiServiceType.DOUBT_SOLVER },
    });
  }

  /**
   * Find or create User AI Wallet
   */
  public async findOrCreateWallet(userId: string) {
    let wallet = await prisma.aiWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await prisma.aiWallet.create({
        data: {
          userId,
          currentBalance: 100, // Initial promotional allocation
          lifetimeCreditsCredited: 100,
          lifetimeCreditsConsumed: 0,
        },
      });
    }

    return wallet;
  }

  /**
   * Create new AI Doubt Solver Session thread
   */
  public async createSession(data: {
    userId: string;
    createdById?: string | null;
    employeeId?: string | null;
    input: CreateDoubtSolverSessionInput;
  }) {
    const { userId, createdById, employeeId, input } = data;

    return prisma.$transaction(async (tx: any) => {
      const aiSession = await tx.aiSession.create({
        data: {
          userId,
          createdById: createdById || null,
          employeeId: employeeId || null,
          serviceType: AiServiceType.DOUBT_SOLVER,
          status: AiSessionStatus.COMPLETED,
          creditsConsumed: 0,
          promptSummary: input.title || "Technical Doubt Consultation",
          additionalInformation: input.additionalInformation as any,
        },
      });

      const doubtSession = await tx.aiDoubtSolverSession.create({
        data: {
          sessionId: aiSession.id,
          title: input.title || "Technical Doubt Consultation",
          topicCategory: input.topicCategory || "Interior Design",
          intelligenceMode: input.intelligenceMode || "smart",
          additionalInformation: input.additionalInformation as any,
        },
        include: {
          session: {
            select: {
              id: true,
              userId: true,
              createdById: true,
              employeeId: true,
              creditsConsumed: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return doubtSession;
    });
  }

  /**
   * List paginated sessions for a user
   */
  public async listSessions(
    userId: string,
    query: QueryDoubtSolverSessionsInput
  ) {
    const { page = 1, limit = 20, search, topicCategory } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      session: {
        userId,
        serviceType: AiServiceType.DOUBT_SOLVER,
      },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { topicCategory: { contains: search, mode: "insensitive" } },
      ];
    }

    if (topicCategory && topicCategory !== "All") {
      where.topicCategory = { equals: topicCategory, mode: "insensitive" };
    }

    const [total, items] = await Promise.all([
      prisma.aiDoubtSolverSession.count({ where }),
      prisma.aiDoubtSolverSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          session: {
            select: {
              id: true,
              userId: true,
              createdById: true,
              employeeId: true,
              creditsConsumed: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          messages: {
            take: 2,
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Doubt Solver Session by ID with full message thread
   */
  public async getSessionById(sessionId: string, userId: string) {
    return prisma.aiDoubtSolverSession.findFirst({
      where: {
        OR: [{ sessionId }, { id: sessionId }],
        session: { userId },
      },
      include: {
        session: {
          select: {
            id: true,
            userId: true,
            createdById: true,
            employeeId: true,
            creditsConsumed: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Append a message to an active Doubt Solver Session
   */
  public async addMessage(
    doubtSolverSessionId: string,
    data: {
      sender: AiChatMessageSender;
      messageText: string;
      structuredPoints?: any;
      concludingNote?: string;
      attachedMedia?: any;
      additionalInformation?: any;
    }
  ) {
    return prisma.aiDoubtSolverChatMessage.create({
      data: {
        doubtSolverSessionId,
        sender: data.sender,
        messageText: data.messageText,
        structuredPoints: data.structuredPoints || null,
        concludingNote: data.concludingNote || null,
        attachedMedia: data.attachedMedia || null,
        additionalInformation: data.additionalInformation || null,
      },
    });
  }

  /**
   * Atomically deduct credits from user wallet and log ledger transaction
   */
  public async atomicDeductCredits(params: {
    userId: string;
    employeeId: string | null;
    sessionId: string;
    cost: number;
    description: string;
  }) {
    const { userId, employeeId, sessionId, cost, description } = params;

    return prisma.$transaction(async (tx: any) => {
      // 1. Fetch wallet with lock/verification
      let wallet = await tx.aiWallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        wallet = await tx.aiWallet.create({
          data: {
            userId,
            currentBalance: 100,
            lifetimeCreditsCredited: 100,
            lifetimeCreditsConsumed: 0,
          },
        });
      }

      if (wallet.currentBalance < cost) {
        throw new Error(
          `INSUFFICIENT_CREDITS: Required ${cost} credits, but current balance is only ${wallet.currentBalance} credits.`
        );
      }

      const balanceAfter = wallet.currentBalance - cost;

      // 2. Update wallet balance
      const updatedWallet = await tx.aiWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { decrement: cost },
          lifetimeCreditsConsumed: { increment: cost },
        },
      });

      // 3. Update AI session total credits consumed
      await tx.aiSession.update({
        where: { id: sessionId },
        data: {
          creditsConsumed: { increment: cost },
          updatedAt: new Date(),
        },
      });

      // 4. Record transaction ledger entry
      const transaction = await tx.aiCreditTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          employeeId: employeeId || null,
          sessionId,
          transactionType: AiTransactionType.USAGE_DEBIT,
          credits: -cost,
          balanceAfter,
          description,
        },
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });
  }

  /**
   * Rate a message
   */
  public async rateMessage(
    messageId: string,
    rating: number,
    userId: string
  ) {
    const message = await prisma.aiDoubtSolverChatMessage.findFirst({
      where: {
        id: messageId,
        doubtSolverSession: {
          session: { userId },
        },
      },
    });

    if (!message) {
      return null;
    }

    return prisma.aiDoubtSolverChatMessage.update({
      where: { id: messageId },
      data: { userFeedbackRating: rating },
    });
  }

  /**
   * Update session details (title, topicCategory, etc.)
   */
  public async updateSession(
    sessionId: string,
    userId: string,
    data: UpdateDoubtSolverSessionInput
  ) {
    const session = await prisma.aiDoubtSolverSession.findFirst({
      where: {
        sessionId,
        session: { userId },
      },
    });

    if (!session) return null;

    return prisma.aiDoubtSolverSession.update({
      where: { id: session.id },
      data: {
        title: data.title ?? session.title,
        topicCategory: data.topicCategory ?? session.topicCategory,
        intelligenceMode: data.intelligenceMode ?? session.intelligenceMode,
        additionalInformation: data.additionalInformation as any,
      },
    });
  }

  /**
   * Delete session and all related records
   */
  public async deleteSession(sessionId: string, userId: string) {
    const session = await prisma.aiSession.findFirst({
      where: {
        OR: [{ id: sessionId }, { doubtSolverSession: { id: sessionId } }],
        userId,
      },
    });

    if (!session) return null;

    return prisma.aiSession.delete({
      where: { id: session.id },
    });
  }
}

