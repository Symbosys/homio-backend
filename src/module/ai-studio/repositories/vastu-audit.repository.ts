import { prisma } from "../../../lib/prisma.js";
import {
  AiServiceType,
  AiTransactionType,
  AiSessionStatus,
} from "../../../types/types.js";
import type {
  QueryVastuAuditsInput,
  UpdateVastuAuditInput,
} from "../validators/vastu-audit.validator.js";

export class VastuAuditRepository {
  /**
   * Get active service rate for Vastu spatial audits
   */
  public async getVastuServiceRate() {
    return prisma.aiServiceRate.findUnique({
      where: { serviceType: AiServiceType.VASTU_CONSULTATION },
    });
  }

  /**
   * Find or initialize organization AI wallet
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
   * Create AiSession and associated AiVastuAuditSession satellite record
   */
  public async createVastuAuditSession(data: {
    organizationId: string;
    employeeId: string | null;
    propertyType: string;
    facingDirection: string;
    totalAreaSqft?: number | null;
    numberOfFloors?: number;
    floorPlanUrl?: any;
    sitePhotos?: any;
    overallScore: number;
    zoneBreakdown?: any;
    remedialSolutions?: any;
    boqEstimations?: any;
    pdfReportUrl?: any;
    additionalInformation?: any;
    executionDurationMs?: number;
  }) {
    return prisma.$transaction(async (tx) => {
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

      // 1. Create root AI Session
      const session = await tx.aiSession.create({
        data: {
          organizationId: data.organizationId,
          employeeId: validEmployeeId,
          serviceType: AiServiceType.VASTU_CONSULTATION,
          status: AiSessionStatus.COMPLETED,
          creditsConsumed: 0,
          executionDurationMs: data.executionDurationMs,
          promptSummary: `Vastu Spatial Audit for ${data.propertyType} (${data.facingDirection} Facing)`,
          additionalInformation: {
            propertyType: data.propertyType,
            facingDirection: data.facingDirection,
            overallScore: data.overallScore,
            ...(data.additionalInformation || {}),
          },
        },
      });

      // 2. Create Vastu Audit Satellite
      const vastuSession = await tx.aiVastuAuditSession.create({
        data: {
          sessionId: session.id,
          propertyType: data.propertyType,
          facingDirection: data.facingDirection,
          totalAreaSqft: data.totalAreaSqft,
          numberOfFloors: data.numberOfFloors || 1,
          floorPlanUrl: data.floorPlanUrl || null,
          sitePhotos: data.sitePhotos || null,
          overallScore: data.overallScore,
          zoneBreakdown: data.zoneBreakdown || null,
          remedialSolutions: data.remedialSolutions || null,
          boqEstimations: data.boqEstimations || null,
          pdfReportUrl: data.pdfReportUrl || null,
          additionalInformation: data.additionalInformation as any,
        },
        include: {
          session: true,
        },
      });

      return vastuSession;
    });
  }

  /**
   * Atomic Credit Deduction & Ledger Transaction
   */
  public async atomicDeductCredits(data: {
    organizationId: string;
    employeeId: string | null;
    sessionId: string;
    cost: number;
    description: string;
  }) {
    const { organizationId, employeeId, sessionId, cost, description } = data;

    return prisma.$transaction(async (tx) => {
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

      const wallet = await tx.aiWallet.findUniqueOrThrow({
        where: { organizationId },
      });

      const balanceAfter = wallet.currentBalance - cost;

      const updatedWallet = await tx.aiWallet.update({
        where: { organizationId },
        data: {
          currentBalance: { decrement: cost },
          lifetimeCreditsConsumed: { increment: cost },
        },
      });

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

      await tx.aiSession.update({
        where: { id: sessionId },
        data: {
          creditsConsumed: cost,
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Query paginated Vastu audits
   */
  public async listSessions(
    organizationId: string,
    query: QueryVastuAuditsInput
  ) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {
      session: {
        organizationId,
        serviceType: AiServiceType.VASTU_CONSULTATION,
      },
    };

    if (query.propertyType) {
      where.propertyType = {
        contains: query.propertyType,
        mode: "insensitive",
      };
    }

    if (query.facingDirection) {
      where.facingDirection = {
        contains: query.facingDirection,
        mode: "insensitive",
      };
    }

    if (query.search) {
      where.OR = [
        { propertyType: { contains: query.search, mode: "insensitive" } },
        { facingDirection: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.aiVastuAuditSession.count({ where }),
      prisma.aiVastuAuditSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          session: true,
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single Vastu audit by session ID
   */
  public async getSessionById(sessionId: string, organizationId: string) {
    return prisma.aiVastuAuditSession.findFirst({
      where: {
        sessionId,
        session: {
          organizationId,
        },
      },
      include: {
        session: true,
      },
    });
  }

  /**
   * Update Vastu audit metadata
   */
  public async updateSession(
    sessionId: string,
    organizationId: string,
    data: UpdateVastuAuditInput
  ) {
    const existing = await this.getSessionById(sessionId, organizationId);
    if (!existing) return null;

    return prisma.aiVastuAuditSession.update({
      where: { id: existing.id },
      data: {
        propertyType: data.propertyType ?? existing.propertyType,
        facingDirection: data.facingDirection ?? existing.facingDirection,
        additionalInformation: data.additionalInformation as any,
      },
      include: {
        session: true,
      },
    });
  }

  /**
   * Delete Vastu audit session
   */
  public async deleteSession(sessionId: string, organizationId: string) {
    const existing = await this.getSessionById(sessionId, organizationId);
    if (!existing) return null;

    await prisma.aiSession.delete({
      where: { id: sessionId },
    });

    return existing;
  }
}
