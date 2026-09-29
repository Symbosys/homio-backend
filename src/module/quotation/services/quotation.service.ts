import { quotationRepository } from "../repos/quotation.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, QuotationStatus } from "../../../types/types.js";
import type {
  CreateQuotationInput,
  UpdateQuotationInput,
  GetQuotationsQueryParams,
  AdjustQuotationExpiryInput,
} from "../validators/quotation.validator.js";

/**
 * Service layer for Quotation proposal management
 * Handles unique quote numbering, tenant lead validation, financial sanity checks, and multi-criteria queries
 */
export class QuotationService {
  /**
   * Generates a unique, tenant-scoped Quotation proposal number
   * Format: HOM-QT-YYYYMM-XXXX (e.g. HOM-QT-202609-0001)
   *
   * @param organizationId - Tenant UUID
   */
  private async generateQuoteNumber(organizationId: string): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prefix = `HOM-QT-${yearMonth}-`;

    const count = await quotationRepository.countByPrefix(organizationId, prefix);
    const nextSequence = String(count + 1).padStart(4, "0");
    return `${prefix}${nextSequence}`;
  }

  /**
   * Create a new Quotation proposal with nested rooms, items, payment schedule, and PDF pages
   *
   * @param organizationId - Tenant UUID
   * @param input - Validated quotation creation payload
   */
  async createQuotation(organizationId: string, input: CreateQuotationInput) {
    // 1. Verify Lead exists and belongs to the active tenant
    const lead = await quotationRepository.findLeadById(organizationId, input.leadId);
    if (!lead) {
      throw new ErrorResponse(
        `Lead with ID "${input.leadId}" not found in your organization`,
        statusCode.Not_Found
      );
    }

    // 2. Resolve Customer ID (fallback to Lead's Customer if not specified)
    const customerId = input.customerId || lead.customerId || null;

    // 3. Resolve or generate Quote Number
    let quoteNumber = input.quoteNumber?.trim();
    if (!quoteNumber) {
      quoteNumber = await this.generateQuoteNumber(organizationId);
    } else {
      const existing = await quotationRepository.findByQuoteNumber(organizationId, quoteNumber);
      if (existing) {
        quoteNumber = await this.generateQuoteNumber(organizationId);
      }
    }

    // 4. Create complete Quotation and child structures in transaction
    return quotationRepository.create(organizationId, {
      ...input,
      quoteNumber,
      customerId,
    });
  }

  /**
   * Fetch single quotation by ID with complete nested relations
   *
   * @param organizationId - Tenant UUID
   * @param id - Quotation UUID
   */
  async getQuotationById(organizationId: string, id: string) {
    const quotation = await quotationRepository.findById(organizationId, id);
    if (!quotation) {
      throw new ErrorResponse(
        `Quotation with ID "${id}" not found in your organization`,
        statusCode.Not_Found
      );
    }
    return quotation;
  }

  /**
   * Update existing Quotation proposal (all fields, nested rooms, items, payment milestones, PDF pages)
   *
   * @param organizationId - Tenant UUID
   * @param id - Quotation UUID
   * @param input - Validated quotation update payload
   */
  async updateQuotation(
    organizationId: string,
    id: string,
    input: UpdateQuotationInput
  ) {
    // 1. Verify quotation exists in tenant
    const existing = await quotationRepository.findById(organizationId, id);
    if (!existing) {
      throw new ErrorResponse(
        `Quotation with ID "${id}" not found in your organization`,
        statusCode.Not_Found
      );
    }

    // 2. If leadId changed, verify new lead exists in tenant
    if (input.leadId && input.leadId !== existing.leadId) {
      const lead = await quotationRepository.findLeadById(organizationId, input.leadId);
      if (!lead) {
        throw new ErrorResponse(
          `Lead with ID "${input.leadId}" not found in your organization`,
          statusCode.Not_Found
        );
      }
    }

    // 3. Atomically update quotation and child entities
    const updated = await quotationRepository.update(organizationId, id, input);
    if (!updated) {
      throw new ErrorResponse(
        `Failed to update quotation with ID "${id}"`,
        statusCode.Internal_Server_Error
      );
    }

    return updated;
  }

  /**
   * Adjust discount expiry date (adding/subtracting days or setting an explicit datetime)
   *
   * @param organizationId - Tenant UUID
   * @param quotationId - Quotation UUID
   * @param input - Adjustment payload (daysDelta / discountExpiryDate / reason)
   */
  async adjustDiscountExpiry(
    organizationId: string,
    quotationId: string,
    input: AdjustQuotationExpiryInput
  ) {
    const quotation = await quotationRepository.findById(organizationId, quotationId);
    if (!quotation) {
      throw new ErrorResponse(
        `Quotation with ID "${quotationId}" not found in your organization`,
        statusCode.Not_Found
      );
    }

    let newExpiryDate: Date;

    if (input.discountExpiryDate) {
      newExpiryDate = new Date(input.discountExpiryDate);
    } else if (input.daysDelta !== undefined) {
      const baseDate = quotation.discountExpiryDate
        ? new Date(quotation.discountExpiryDate)
        : new Date();
      newExpiryDate = new Date(baseDate.getTime() + input.daysDelta * 86400000);
    } else {
      throw new ErrorResponse(
        "Either daysDelta or discountExpiryDate is required",
        statusCode.Bad_Request
      );
    }

    // If new expiry is in the future and the quote was marked EXPIRED, reactivate it
    let newStatus: QuotationStatus | undefined = undefined;
    const now = new Date();
    if (newExpiryDate > now && quotation.status === QuotationStatus.EXPIRED) {
      newStatus = QuotationStatus.SENT;
    } else if (
      newExpiryDate <= now &&
      quotation.status !== QuotationStatus.ACCEPTED &&
      quotation.status !== QuotationStatus.BOOKED
    ) {
      newStatus = QuotationStatus.EXPIRED;
    }

    return quotationRepository.updateDiscountExpiry(
      organizationId,
      quotationId,
      newExpiryDate,
      newStatus
    );
  }

  /**
   * Fetch paginated list of quotations with comprehensive multi-criteria filters
   *
   * @param organizationId - Tenant UUID
   * @param query - Filter parameters
   */
  async getQuotations(organizationId: string, query: GetQuotationsQueryParams) {
    return quotationRepository.findManyWithFilters(organizationId, query);
  }
}

export const quotationService = new QuotationService();


