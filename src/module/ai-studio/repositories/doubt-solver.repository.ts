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
   * Find or create Organization AI Wallet
   */
  public async findOrCreateWallet(organizationId: string) {
    let wallet = await prisma.aiWallet.findUnique({
      where: { organizationId },
    });

    if (!wallet) {
      wallet = await prisma.aiWallet.create({
        data: {
          organizationId,
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
  public async createSession(
    organizationId: string,
    employeeId: string | null,
    input: CreateDoubtSolverSessionInput
  ) {
    return prisma.$transaction(async (tx: any) => {
      // Safe check for valid employee FK
      let validEmployeeId: string | null = null;
      if (employeeId) {
        const emp = await tx.employee.findFirst({
          where: {
            OR: [
              { id: employeeId },
              { userId: employeeId },
            ],
            organizationId,
          },
          select: { id: true },
        });
        if (emp) {
          validEmployeeId = emp.id;
        }
      }

      const aiSession = await tx.aiSession.create({
        data: {
          organizationId,
          employeeId: validEmployeeId,
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
              organizationId: true,
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
   * List paginated sessions for an organization
   */
  public async listSessions(
    organizationId: string,
    query: QueryDoubtSolverSessionsInput
  ) {
    const { page = 1, limit = 20, search, topicCategory } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      session: {
        organizationId,
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
  public async getSessionById(sessionId: string, organizationId: string) {
    return prisma.aiDoubtSolverSession.findFirst({
      where: {
        sessionId,
        session: { organizationId },
      },
      include: {
        session: {
          select: {
            id: true,
            organizationId: true,
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
   * Atomically deduct credits from organization wallet and log ledger transaction
   */
  public async atomicDeductCredits(params: {
    organizationId: string;
    employeeId: string | null;
    sessionId: string;
    cost: number;
    description: string;
  }) {
    const { organizationId, employeeId, sessionId, cost, description } = params;

    return prisma.$transaction(async (tx: any) => {
      // 1. Fetch wallet with lock/verification
      let wallet = await tx.aiWallet.findUnique({
        where: { organizationId },
      });

      if (!wallet) {
        wallet = await tx.aiWallet.create({
          data: {
            organizationId,
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

      // Safe check for valid employee FK
      let validEmployeeId: string | null = null;
      if (employeeId) {
        const emp = await tx.employee.findFirst({
          where: {
            OR: [
              { id: employeeId },
              { userId: employeeId },
            ],
            organizationId,
          },
          select: { id: true },
        });
        if (emp) {
          validEmployeeId = emp.id;
        }
      }

      // 4. Record transaction ledger entry
      const transaction = await tx.aiCreditTransaction.create({
        data: {
          organizationId,
          walletId: wallet.id,
          employeeId: validEmployeeId,
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
    organizationId: string
  ) {
    const message = await prisma.aiDoubtSolverChatMessage.findFirst({
      where: {
        id: messageId,
        doubtSolverSession: {
          session: { organizationId },
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
    organizationId: string,
    data: UpdateDoubtSolverSessionInput
  ) {
    const session = await prisma.aiDoubtSolverSession.findFirst({
      where: {
        sessionId,
        session: { organizationId },
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
  public async deleteSession(sessionId: string, organizationId: string) {
    const session = await prisma.aiSession.findFirst({
      where: { id: sessionId, organizationId },
    });

    if (!session) return null;

    return prisma.aiSession.delete({
      where: { id: sessionId },
    });
  }
}
