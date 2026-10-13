import { prisma } from "../../../lib/prisma.js";
import {
  AiServiceType,
  AiTransactionType,
} from "../../../types/types.js";
import type {
  CreateCreditPackInput,
  UpdateCreditPackInput,
  UpdateServiceRateInput,
  GetOrgWalletsQuery,
} from "../validators/ai-studio.validator.js";

export class AiStudioRepository {
  // ==========================================
  // TOP-UP CREDIT PACKS (Platform Catalog)
  // ==========================================

  /**
   * List all credit packs ordered by sortOrder and price
   */
  async findAllCreditPacks(onlyActive = false) {
    return prisma.aiCreditPack.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });
  }

  /**
   * Find credit pack by ID
   */
  async findCreditPackById(id: string) {
    return prisma.aiCreditPack.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new top-up credit pack
   */
  async createCreditPack(data: CreateCreditPackInput) {
    return prisma.aiCreditPack.create({
      data: {
        name: data.name,
        slug: data.slug,
        credits: data.credits,
        bonusCredits: data.bonusCredits,
        price: data.price,
        currency: data.currency,
        discountPercentage: data.discountPercentage,
        isPopular: data.isPopular,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        additionalInformation: data.additionalInformation || undefined,
      },
    });
  }

  /**
   * Update top-up credit pack
   */
  async updateCreditPack(id: string, data: UpdateCreditPackInput) {
    return prisma.aiCreditPack.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.credits !== undefined && { credits: data.credits }),
        ...(data.bonusCredits !== undefined && { bonusCredits: data.bonusCredits }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.discountPercentage !== undefined && { discountPercentage: data.discountPercentage }),
        ...(data.isPopular !== undefined && { isPopular: data.isPopular }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation || undefined }),
      },
    });
  }

  /**
   * Delete top-up credit pack
   */
  async deleteCreditPack(id: string) {
    return prisma.aiCreditPack.delete({
      where: { id },
    });
  }

  // ==========================================
  // AI SERVICE RATES (Platform Pricing Matrix)
  // ==========================================

  /**
   * Fetch all AI service rates
   */
  async findAllServiceRates() {
    return prisma.aiServiceRate.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Find specific service rate by enum type
   */
  async findServiceRateByType(serviceType: AiServiceType) {
    return prisma.aiServiceRate.findUnique({
      where: { serviceType },
    });
  }

  /**
   * Upsert AI service pricing rate
   */
  async upsertServiceRate(serviceType: AiServiceType, data: UpdateServiceRateInput) {
    return prisma.aiServiceRate.upsert({
      where: { serviceType },
      update: {
        ...(data.name && { name: data.name }),
        defaultCreditCost: data.defaultCreditCost,
        billingUnit: data.billingUnit,
        description: data.description,
        ...(data.modelKey && { modelKey: data.modelKey }),
        isActive: data.isActive,
        ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation || undefined }),
      },
      create: {
        serviceType,
        name: data.name || serviceType.replace(/_/g, " ").toLowerCase(),
        defaultCreditCost: data.defaultCreditCost,
        billingUnit: data.billingUnit,
        description: data.description,
        modelKey: data.modelKey || "gpt-4o-mini",
        isActive: data.isActive,
        additionalInformation: data.additionalInformation || undefined,
      },
    });
  }

  // ==========================================
  // USER WALLETS & TRANSACTIONS
  // ==========================================

  /**
   * Find or initialize a User's AI Wallet
   */
  async findOrCreateWallet(userId: string) {
    return prisma.aiWallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currentBalance: 100, // Initial promotional allocation
        lifetimeCreditsCredited: 100,
        lifetimeCreditsConsumed: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            organizationId: true,
            userType: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated user wallets for platform overview
   */
  async findWalletsPaginated(query: GetOrgWalletsQuery) {
    const { search, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: any = search
      ? {
          OR: [
            { user: { firstName: { contains: search, mode: "insensitive" } } },
            { user: { lastName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {};

    const orderBy: any =
      sortBy === "name"
        ? { user: { firstName: sortOrder } }
        : sortBy === "email"
        ? { user: { email: sortOrder } }
        : { [sortBy]: sortOrder };

    const [total, wallets] = await Promise.all([
      prisma.aiWallet.count({ where }),
      prisma.aiWallet.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              organizationId: true,
              userType: true,
            },
          },
          _count: {
            select: { transactions: true },
          },
        },
      }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), wallets };
  }

  /**
   * Atomic User Wallet Recharge within a Prisma Transaction
   */
  async executeRechargeTransaction(params: {
    userId: string;
    creditsToAdd: number;
    amountPaid?: number | null;
    currency?: string;
    creditPackId?: string | null;
    transactionType: AiTransactionType;
    paymentGatewayRef?: string | null;
    invoiceNumber?: string | null;
    description: string;
    employeeId?: string | null;
    additionalInformation?: any;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Ensure wallet exists and fetch current balance
      let wallet = await tx.aiWallet.findUnique({
        where: { userId: params.userId },
      });

      if (!wallet) {
        wallet = await tx.aiWallet.create({
          data: {
            userId: params.userId,
            currentBalance: 0,
            lifetimeCreditsCredited: 0,
            lifetimeCreditsConsumed: 0,
          },
        });
      }

      const newBalance = wallet.currentBalance + params.creditsToAdd;
      const newLifetimeCredited = wallet.lifetimeCreditsCredited + params.creditsToAdd;

      // 2. Update wallet balance and stats
      const updatedWallet = await tx.aiWallet.update({
        where: { id: wallet.id },
        data: {
          currentBalance: newBalance,
          lifetimeCreditsCredited: newLifetimeCredited,
          lastRefilledAt: new Date(),
        },
      });

      // 3. Create immutable transaction record
      const transaction = await tx.aiCreditTransaction.create({
        data: {
          userId: params.userId,
          walletId: wallet.id,
          employeeId: params.employeeId || null,
          creditPackId: params.creditPackId || null,
          transactionType: params.transactionType,
          credits: params.creditsToAdd,
          balanceAfter: newBalance,
          amountPaid: params.amountPaid !== undefined && params.amountPaid !== null ? params.amountPaid : null,
          currency: params.currency || "INR",
          paymentGatewayRef: params.paymentGatewayRef || null,
          invoiceNumber: params.invoiceNumber || null,
          description: params.description,
          additionalInformation: params.additionalInformation || undefined,
        },
        include: {
          creditPack: true,
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true, avatarUrl: true },
          },
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
        },
      });

      return { wallet: updatedWallet, transaction };
    });
  }

  /**
   * Get transactions across users with pagination
   */
  async findTransactionsPaginated(params: {
    userId?: string;
    page: number;
    limit: number;
    transactionType?: AiTransactionType;
  }) {
    const { userId, page, limit, transactionType } = params;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(userId && { userId }),
      ...(transactionType && { transactionType }),
    };

    const [total, transactions] = await Promise.all([
      prisma.aiCreditTransaction.count({ where }),
      prisma.aiCreditTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          creditPack: {
            select: { id: true, name: true, slug: true },
          },
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return { total, page, limit, totalPages: Math.ceil(total / limit), transactions };
  }
}
