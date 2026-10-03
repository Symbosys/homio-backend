import { prisma } from "../../../lib/prisma.js";
import {
  AiServiceType,
  AiSessionStatus,
  AiTransactionType,
} from "../../../types/types.js";
import type {
  QueryRoomDesignSessionsInput,
  UpdateRoomDesignSessionInput,
} from "../validators/room-designer.validator.js";

export class RoomDesignerRepository {
  /**
   * Fetch active credit pricing rate for Room Designer
   */
  public async getRoomDesignerServiceRate() {
    return prisma.aiServiceRate.findUnique({
      where: { serviceType: AiServiceType.ROOM_DESIGN },
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
          currentBalance: 100,
          lifetimeCreditsCredited: 100,
          lifetimeCreditsConsumed: 0,
        },
      });
    }

    return wallet;
  }

  /**
   * Create new Room Design Session with generated render and optional variations
   */
  public async createRoomDesignSession(data: {
    organizationId: string;
    employeeId: string | null;
    roomType: string;
    designStyle: string;
    colorPalette?: any;
    materialPreferences?: any;
    lightingMode?: string;
    beforeImageUrl?: any;
    generatedImageUrl: any;
    alternativeRenders?: any;
    generationMetadata?: any;
    additionalInformation?: any;
    executionDurationMs?: number;
  }) {
    return prisma.$transaction(async (tx: any) => {
      // Safe check for valid employee FK
      let validEmployeeId: string | null = null;
      if (data.employeeId) {
        const emp = await tx.employee.findFirst({
          where: {
            OR: [
              { id: data.employeeId },
              { userId: data.employeeId },
            ],
            organizationId: data.organizationId,
          },
          select: { id: true },
        });
        if (emp) {
          validEmployeeId = emp.id;
        }
      }

      const promptSummary = `${data.designStyle} ${data.roomType} Render`;

      const aiSession = await tx.aiSession.create({
        data: {
          organizationId: data.organizationId,
          employeeId: validEmployeeId,
          serviceType: AiServiceType.ROOM_DESIGN,
          status: AiSessionStatus.COMPLETED,
          creditsConsumed: 0,
          promptSummary,
          executionDurationMs: data.executionDurationMs,
          additionalInformation: data.additionalInformation as any,
        },
      });

      const roomSession = await tx.aiRoomDesignSession.create({
        data: {
          sessionId: aiSession.id,
          roomType: data.roomType,
          designStyle: data.designStyle,
          colorPalette: data.colorPalette || null,
          materialPreferences: data.materialPreferences || null,
          lightingMode: data.lightingMode || null,
          beforeImageUrl: data.beforeImageUrl || null,
          generatedImageUrl: data.generatedImageUrl,
          alternativeRenders: data.alternativeRenders || null,
          generationMetadata: data.generationMetadata || null,
          additionalInformation: data.additionalInformation as any,
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
        },
      });

      return roomSession;
    });
  }

  /**
   * List paginated room design sessions
   */
  public async listSessions(
    organizationId: string,
    query: QueryRoomDesignSessionsInput
  ) {
    const { page = 1, limit = 12, search, roomType, designStyle } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      session: {
        organizationId,
        serviceType: AiServiceType.ROOM_DESIGN,
      },
    };

    if (search) {
      where.OR = [
        { roomType: { contains: search, mode: "insensitive" } },
        { designStyle: { contains: search, mode: "insensitive" } },
      ];
    }

    if (roomType && roomType !== "All") {
      where.roomType = { equals: roomType, mode: "insensitive" };
    }

    if (designStyle && designStyle !== "All") {
      where.designStyle = { equals: designStyle, mode: "insensitive" };
    }

    const [total, items] = await Promise.all([
      prisma.aiRoomDesignSession.count({ where }),
      prisma.aiRoomDesignSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          session: {
            select: {
              id: true,
              creditsConsumed: true,
              createdAt: true,
              updatedAt: true,
            },
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
   * Get single room design session by ID
   */
  public async getSessionById(sessionId: string, organizationId: string) {
    return prisma.aiRoomDesignSession.findFirst({
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

      const updatedWallet = await tx.aiWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: { decrement: cost },
          lifetimeCreditsConsumed: { increment: cost },
        },
      });

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
   * Update room design session metadata
   */
  public async updateSession(
    sessionId: string,
    organizationId: string,
    data: UpdateRoomDesignSessionInput
  ) {
    const session = await prisma.aiRoomDesignSession.findFirst({
      where: {
        sessionId,
        session: { organizationId },
      },
    });

    if (!session) return null;

    return prisma.aiRoomDesignSession.update({
      where: { id: session.id },
      data: {
        roomType: data.roomType ?? session.roomType,
        designStyle: data.designStyle ?? session.designStyle,
        additionalInformation: data.additionalInformation as any,
      },
    });
  }

  /**
   * Delete room design session (returns deleted session for media cleanup)
   */
  public async deleteSession(sessionId: string, organizationId: string) {
    const session = await prisma.aiRoomDesignSession.findFirst({
      where: {
        sessionId,
        session: { organizationId },
      },
    });

    if (!session) return null;

    await prisma.aiSession.delete({
      where: { id: sessionId },
    });

    return session;
  }
}
