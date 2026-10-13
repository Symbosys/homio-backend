import { prisma } from "../../../lib/prisma.js";
import { AiStudioRepository } from "../repos/ai-studio.repository.js";
import {
  AiServiceType,
  AiTransactionType,
} from "../../../types/types.js";
import type {
  CreateCreditPackInput,
  UpdateCreditPackInput,
  UpdateServiceRateInput,
  RechargeOrgWalletInput,
  GetOrgWalletsQuery,
} from "../validators/ai-studio.validator.js";

export class AiStudioPlatformService {
  private repo: AiStudioRepository;

  constructor() {
    this.repo = new AiStudioRepository();
  }

  // ==========================================
  // TOP-UP CREDIT PACKS
  // ==========================================

  async getAllCreditPacks(onlyActive = false) {
    return this.repo.findAllCreditPacks(onlyActive);
  }

  async getCreditPackById(id: string) {
    const pack = await this.repo.findCreditPackById(id);
    if (!pack) {
      throw new Error(`Credit pack with ID ${id} not found`);
    }
    return pack;
  }

  async createCreditPack(input: CreateCreditPackInput) {
    return this.repo.createCreditPack(input);
  }

  async updateCreditPack(id: string, input: UpdateCreditPackInput) {
    await this.getCreditPackById(id);
    return this.repo.updateCreditPack(id, input);
  }

  async deleteCreditPack(id: string) {
    await this.getCreditPackById(id);
    return this.repo.deleteCreditPack(id);
  }

  // ==========================================
  // AI SERVICE RATES (Platform Pricing Matrix)
  // ==========================================

  async getAllServiceRates() {
    const rates = await this.repo.findAllServiceRates();
    
    // If rates table is empty, return default array or initialize
    if (rates.length === 0) {
      const defaultRates: Array<{
        serviceType: AiServiceType;
        name: string;
        defaultCreditCost: number;
        billingUnit: string;
        description: string;
        modelKey: string;
      }> = [
        {
          serviceType: AiServiceType.ROOM_DESIGN,
          name: "AI Room Designer",
          defaultCreditCost: 5,
          billingUnit: "per render",
          description: "Multi-style photorealistic interior visual generation and style transfer",
          modelKey: "gpt-4o-mini",
        },
        {
          serviceType: AiServiceType.VASTU_CONSULTATION,
          name: "AI Vastu Spatial Audit",
          defaultCreditCost: 10,
          billingUnit: "per audit",
          description: "16-zone Vedic directional energy audit, floor plan heatmaps and BOQ remedies",
          modelKey: "gpt-4o-mini",
        },
        {
          serviceType: AiServiceType.DOUBT_SOLVER,
          name: "AI Doubt Solver",
          defaultCreditCost: 1,
          billingUnit: "per query",
          description: "Deducted per individual question asked to chatbot (e.g. 5 questions = 5x credit cost)",
          modelKey: "gpt-4o-mini",
        },
        {
          serviceType: AiServiceType.THREE_D_DESIGN,
          name: "AI 3D Mesh Generator",
          defaultCreditCost: 25,
          billingUnit: "per 3D mesh",
          description: "Interactive 3D voxel energy mesh & walkthrough layout generation",
          modelKey: "gpt-4o-mini",
        },
        {
          serviceType: AiServiceType.VIDEO_DESIGN,
          name: "AI Cinematic Video Walkthrough",
          defaultCreditCost: 50,
          billingUnit: "per 10s video",
          description: "High-definition interior camera motion and lighting walkthrough render",
          modelKey: "gpt-4o-mini",
        },
      ];

      return defaultRates;
    }

    return rates;
  }

  async updateServiceRate(serviceType: AiServiceType, input: UpdateServiceRateInput) {
    return this.repo.upsertServiceRate(serviceType, input);
  }

  // ==========================================
  // USER WALLETS & RECHARGE ENGINE
  // ==========================================

  async getOrgWallets(query: GetOrgWalletsQuery) {
    return this.repo.findWalletsPaginated(query);
  }

  async getOrgWalletDetails(targetId: string) {
    // Check if targetId is an organizationId or userId
    const isUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });

    if (isUser) {
      return this.repo.findOrCreateWallet(isUser.id);
    }

    // Otherwise resolve primary admin user of the organization
    const orgAdmin = await prisma.user.findFirst({
      where: { organizationId: targetId, userType: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });

    if (!orgAdmin) {
      throw new Error(`Target user or organization ${targetId} not found`);
    }

    return this.repo.findOrCreateWallet(orgAdmin.id);
  }

  async rechargeOrganizationWallet(input: RechargeOrgWalletInput) {
    let creditsToAdd = 0;
    let amountPaid: number | null | undefined = input.amountPaid;
    let description = input.description;

    // 1. Resolve targetUserId
    let targetUserId = input.userId;
    if (!targetUserId && input.organizationId) {
      const orgAdmin = await prisma.user.findFirst({
        where: { organizationId: input.organizationId, userType: "ADMIN" },
        orderBy: { createdAt: "asc" },
      });
      if (!orgAdmin) {
        throw new Error(`No primary admin user found for organization ${input.organizationId}`);
      }
      targetUserId = orgAdmin.id;
    }

    if (!targetUserId) {
      throw new Error("Target user could not be resolved for wallet recharge");
    }

    // 2. If pack ID provided, calculate total credits (base + bonus) & amount
    if (input.creditPackId) {
      const pack = await this.repo.findCreditPackById(input.creditPackId);
      if (!pack) {
        throw new Error(`Credit pack with ID ${input.creditPackId} does not exist`);
      }
      creditsToAdd = pack.credits + (pack.bonusCredits || 0);
      if (amountPaid === undefined || amountPaid === null) {
        amountPaid = Number(pack.price);
      }
      description = description || `Recharge with ${pack.name} (${creditsToAdd} Credits)`;
    } else if (input.customCredits) {
      creditsToAdd = input.customCredits;
      description = description || `Custom Admin Grant of ${creditsToAdd} Credits`;
    }

    if (creditsToAdd <= 0) {
      throw new Error("Credits to add must be greater than zero");
    }

    // 3. Execute atomic transaction
    return this.repo.executeRechargeTransaction({
      userId: targetUserId,
      creditsToAdd,
      amountPaid,
      currency: input.currency,
      creditPackId: input.creditPackId,
      transactionType: input.transactionType || AiTransactionType.PACK_PURCHASE,
      paymentGatewayRef: input.paymentGatewayRef,
      invoiceNumber: input.invoiceNumber,
      description,
      additionalInformation: input.additionalInformation,
    });
  }

  async getTransactions(params: {
    userId?: string;
    organizationId?: string;
    page?: number;
    limit?: number;
    transactionType?: AiTransactionType;
  }) {
    let targetUserId = params.userId;
    if (!targetUserId && params.organizationId) {
      const orgAdmin = await prisma.user.findFirst({
        where: { organizationId: params.organizationId, userType: "ADMIN" },
        orderBy: { createdAt: "asc" },
      });
      if (orgAdmin) {
        targetUserId = orgAdmin.id;
      }
    }

    return this.repo.findTransactionsPaginated({
      userId: targetUserId,
      page: params.page || 1,
      limit: params.limit || 20,
      transactionType: params.transactionType,
    });
  }
}
