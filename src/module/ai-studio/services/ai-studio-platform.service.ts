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
      }> = [
        {
          serviceType: AiServiceType.ROOM_DESIGN,
          name: "AI Room Designer",
          defaultCreditCost: 5,
          billingUnit: "per render",
          description: "Multi-style photorealistic interior visual generation and style transfer",
        },
        {
          serviceType: AiServiceType.VASTU_CONSULTATION,
          name: "AI Vastu Spatial Audit",
          defaultCreditCost: 10,
          billingUnit: "per audit",
          description: "16-zone Vedic directional energy audit, floor plan heatmaps and BOQ remedies",
        },
        {
          serviceType: AiServiceType.DOUBT_SOLVER,
          name: "AI Doubt Solver",
          defaultCreditCost: 1,
          billingUnit: "per query",
          description: "Deducted per individual question asked to chatbot (e.g. 5 questions = 5x credit cost)",
        },
        {
          serviceType: AiServiceType.THREE_D_DESIGN,
          name: "AI 3D Mesh Generator",
          defaultCreditCost: 25,
          billingUnit: "per 3D mesh",
          description: "Interactive 3D voxel energy mesh & walkthrough layout generation",
        },
        {
          serviceType: AiServiceType.VIDEO_DESIGN,
          name: "AI Cinematic Video Walkthrough",
          defaultCreditCost: 50,
          billingUnit: "per 10s video",
          description: "High-definition interior camera motion and lighting walkthrough render",
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
  // TENANT WALLETS & RECHARGE ENGINE
  // ==========================================

  async getOrgWallets(query: GetOrgWalletsQuery) {
    return this.repo.findWalletsPaginated(query);
  }

  async getOrgWalletDetails(organizationId: string) {
    return this.repo.findOrCreateWallet(organizationId);
  }

  async rechargeOrganizationWallet(input: RechargeOrgWalletInput) {
    let creditsToAdd = 0;
    let amountPaid: number | null | undefined = input.amountPaid;
    let description = input.description;

    // 1. If pack ID provided, calculate total credits (base + bonus) & amount
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

    // 2. Execute atomic transaction
    return this.repo.executeRechargeTransaction({
      organizationId: input.organizationId,
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
    organizationId?: string;
    page?: number;
    limit?: number;
    transactionType?: AiTransactionType;
  }) {
    return this.repo.findTransactionsPaginated({
      organizationId: params.organizationId,
      page: params.page || 1,
      limit: params.limit || 20,
      transactionType: params.transactionType,
    });
  }
}
