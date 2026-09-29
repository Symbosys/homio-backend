import { quotationTermsTemplateRepo } from "../repos/quotation-terms-template.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateTermsTemplateInput,
  UpdateTermsTemplateInput,
  GetTermsTemplatesQueryInput,
  DuplicateTermsTemplateInput,
} from "../validators/quotation-terms-template.validator.js";

/**
 * Service: Quotation Terms, Warranty & Legal Sign-off Management
 * Handles terms clauses, warranty specs, client sign-off templates, default selection, and cloning
 */
export class QuotationTermsTemplateService {
  /**
   * Create a new Terms Template
   */
  async createTermsTemplate(organizationId: string, input: CreateTermsTemplateInput) {
    if (input.isDefault) {
      await quotationTermsTemplateRepo.clearExistingDefault(organizationId);
    }

    return quotationTermsTemplateRepo.create(organizationId, {
      ...input,
      code: input.code ? input.code.trim().toUpperCase() : null,
      description: input.description || null,
      warrantyClauses: input.warrantyClauses || null,
      paymentTermsNote: input.paymentTermsNote || null,
      clientSignoffNote: input.clientSignoffNote || null,
      additionalInformation: input.additionalInformation || undefined,
    });
  }

  /**
   * List all non-paginated Terms Templates
   */
  async getTermsTemplates(organizationId: string, query: GetTermsTemplatesQueryInput) {
    return quotationTermsTemplateRepo.findAll(organizationId, query);
  }

  /**
   * Get single Terms Template by ID
   */
  async getTermsTemplateById(id: string, organizationId: string) {
    const template = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!template) {
      throw new ErrorResponse("Terms & conditions template not found", statusCode.Not_Found);
    }
    return template;
  }

  /**
   * Get active default Terms Template for the tenant
   */
  async getDefaultTermsTemplate(organizationId: string) {
    const template = await quotationTermsTemplateRepo.findDefault(organizationId);
    if (!template) {
      throw new ErrorResponse("No default terms template configured for your organization", statusCode.Not_Found);
    }
    return template;
  }

  /**
   * Update Terms Template (partial / dirty update)
   */
  async updateTermsTemplate(id: string, organizationId: string, input: UpdateTermsTemplateInput) {
    const existing = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Terms & conditions template not found", statusCode.Not_Found);
    }

    if (input.isDefault) {
      await quotationTermsTemplateRepo.clearExistingDefault(organizationId, id);
    }

    const updatePayload: any = {
      ...input,
      code: input.code !== undefined ? (input.code ? input.code.trim().toUpperCase() : null) : undefined,
      description: input.description !== undefined ? input.description : undefined,
      warrantyClauses: input.warrantyClauses !== undefined ? input.warrantyClauses : undefined,
      paymentTermsNote: input.paymentTermsNote !== undefined ? input.paymentTermsNote : undefined,
      clientSignoffNote: input.clientSignoffNote !== undefined ? input.clientSignoffNote : undefined,
      additionalInformation: input.additionalInformation !== undefined ? input.additionalInformation : undefined,
    };

    return quotationTermsTemplateRepo.update(id, organizationId, updatePayload);
  }

  /**
   * Set specific template as default
   */
  async setDefaultTermsTemplate(id: string, organizationId: string) {
    const existing = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Terms & conditions template not found", statusCode.Not_Found);
    }

    await quotationTermsTemplateRepo.clearExistingDefault(organizationId, id);
    return quotationTermsTemplateRepo.update(id, organizationId, {
      isDefault: true,
      isActive: true,
    });
  }

  /**
   * Duplicate / clone an existing terms template
   */
  async duplicateTermsTemplate(id: string, organizationId: string, input: DuplicateTermsTemplateInput) {
    const existing = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Original terms template not found", statusCode.Not_Found);
    }

    return quotationTermsTemplateRepo.create(organizationId, {
      name: input.name.trim(),
      code: input.code ? input.code.trim().toUpperCase() : null,
      description: existing.description,
      termsAndConditions: existing.termsAndConditions,
      warrantyClauses: existing.warrantyClauses,
      paymentTermsNote: existing.paymentTermsNote,
      clientSignoffNote: existing.clientSignoffNote,
      isDefault: false,
      isActive: true,
      additionalInformation: existing.additionalInformation ? (existing.additionalInformation as any) : undefined,
    });
  }

  /**
   * Soft delete Terms Template
   */
  async deleteTermsTemplate(id: string, organizationId: string) {
    const existing = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Terms & conditions template not found", statusCode.Not_Found);
    }

    await quotationTermsTemplateRepo.softDelete(id, organizationId);
    return { message: "Terms template deleted successfully" };
  }

  /**
   * Toggle active state of Terms Template
   */
  async toggleActive(id: string, organizationId: string) {
    const existing = await quotationTermsTemplateRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Terms & conditions template not found", statusCode.Not_Found);
    }

    return quotationTermsTemplateRepo.toggleActive(id, existing.isActive);
  }
}

export const quotationTermsTemplateService = new QuotationTermsTemplateService();
