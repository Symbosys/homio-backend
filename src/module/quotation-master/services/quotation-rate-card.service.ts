import { quotationRateCardRepo } from "../repos/quotation-rate-card.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateRateCardInput,
  UpdateRateCardInput,
  GetRateCardsQueryInput,
  ReorderRateCardsInput,
} from "../validators/quotation-rate-card.validator.js";

/**
 * Service: Quotation Rate Card & Markup Management
 * Handles multi-tiered pricing markup strategies, category-level overrides, default card switching, and reordering
 */
export class QuotationRateCardService {
  /**
   * Create a new Rate Card
   */
  async createRateCard(organizationId: string, input: CreateRateCardInput) {
    const normalizedCode = input.code.trim().toUpperCase();

    // Check code uniqueness within tenant
    const existing = await quotationRateCardRepo.findByCode(normalizedCode, organizationId);
    if (existing) {
      throw new ErrorResponse(`Rate card with code "${normalizedCode}" already exists in your organization`, statusCode.Conflict);
    }

    // If marked as default, clear existing default in tenant
    if (input.isDefault) {
      await quotationRateCardRepo.clearExistingDefault(organizationId);
    }

    return quotationRateCardRepo.create(organizationId, {
      ...input,
      code: normalizedCode,
      description: input.description || null,
      categoryMarkups: input.categoryMarkups || undefined,
      additionalInformation: input.additionalInformation || undefined,
    });
  }

  /**
   * List all non-paginated Rate Cards for the tenant
   */
  async getRateCards(organizationId: string, query: GetRateCardsQueryInput) {
    return quotationRateCardRepo.findAll(organizationId, query);
  }

  /**
   * Get single Rate Card by ID
   */
  async getRateCardById(id: string, organizationId: string) {
    const card = await quotationRateCardRepo.findById(id, organizationId);
    if (!card) {
      throw new ErrorResponse("Rate card not found", statusCode.Not_Found);
    }
    return card;
  }

  /**
   * Get the active default Rate Card for the tenant
   */
  async getDefaultRateCard(organizationId: string) {
    const card = await quotationRateCardRepo.findDefault(organizationId);
    if (!card) {
      throw new ErrorResponse("No default rate card configured for your organization", statusCode.Not_Found);
    }
    return card;
  }

  /**
   * Update Rate Card (partial / dirty update)
   */
  async updateRateCard(id: string, organizationId: string, input: UpdateRateCardInput) {
    const existing = await quotationRateCardRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Rate card not found", statusCode.Not_Found);
    }

    if (input.code) {
      const normalizedCode = input.code.trim().toUpperCase();
      if (normalizedCode !== existing.code) {
        const codeTaken = await quotationRateCardRepo.findByCode(normalizedCode, organizationId);
        if (codeTaken && codeTaken.id !== id) {
          throw new ErrorResponse(`Rate card code "${normalizedCode}" is already in use`, statusCode.Conflict);
        }
      }
    }

    // If setting as default, clear other defaults first
    if (input.isDefault) {
      await quotationRateCardRepo.clearExistingDefault(organizationId, id);
    }

    const updatePayload: any = {
      ...input,
      code: input.code ? input.code.trim().toUpperCase() : undefined,
      description: input.description !== undefined ? input.description : undefined,
      categoryMarkups: input.categoryMarkups !== undefined ? input.categoryMarkups : undefined,
      additionalInformation: input.additionalInformation !== undefined ? input.additionalInformation : undefined,
    };

    return quotationRateCardRepo.update(id, organizationId, updatePayload);
  }

  /**
   * Set specific Rate Card as default
   */
  async setDefaultRateCard(id: string, organizationId: string) {
    const existing = await quotationRateCardRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Rate card not found", statusCode.Not_Found);
    }

    // Clear others and set this one
    await quotationRateCardRepo.clearExistingDefault(organizationId, id);
    return quotationRateCardRepo.update(id, organizationId, {
      isDefault: true,
      isActive: true,
    });
  }

  /**
   * Soft delete Rate Card
   */
  async deleteRateCard(id: string, organizationId: string) {
    const existing = await quotationRateCardRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Rate card not found", statusCode.Not_Found);
    }

    await quotationRateCardRepo.softDelete(id, organizationId);
    return { message: "Rate card deleted successfully" };
  }

  /**
   * Toggle active state of Rate Card
   */
  async toggleActive(id: string, organizationId: string) {
    const existing = await quotationRateCardRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Rate card not found", statusCode.Not_Found);
    }

    return quotationRateCardRepo.toggleActive(id, existing.isActive);
  }

  /**
   * Reorder Rate Cards
   */
  async reorderRateCards(organizationId: string, input: ReorderRateCardsInput) {
    await quotationRateCardRepo.reorder(organizationId, input.orders);
    return { message: "Rate cards reordered successfully" };
  }
}

export const quotationRateCardService = new QuotationRateCardService();
