import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadLostReasonRepo } from "../repos/lead-lost-reason.repo.js";
import type {
  CreateLeadLostReasonInput,
  UpdateLeadLostReasonInput,
  GetLeadLostReasonsQuery,
} from "../validators/lead-lost-reason.validator.js";

export class LeadLostReasonService {
  /**
   * Create a new LeadLostReason with duplicate checks
   */
  async createReason(organizationId: string, data: CreateLeadLostReasonInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const [existingName, existingSlug] = await Promise.all([
      leadLostReasonRepo.findByName(data.name, organizationId),
      leadLostReasonRepo.findBySlug(slug, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("A lead lost reason with this name already exists", statusCode.Conflict);
    }
    if (existingSlug) {
      throw new ErrorResponse("A lead lost reason with this slug already exists", statusCode.Conflict);
    }

    return leadLostReasonRepo.create(organizationId, { ...data, slug });
  }

  /**
   * Get paginated lead lost reasons
   */
  async getReasons(organizationId: string, query: GetLeadLostReasonsQuery) {
    return leadLostReasonRepo.findAll(organizationId, query);
  }

  /**
   * Get reason by ID with usage count
   */
  async getReasonById(id: string, organizationId: string) {
    const reason = await leadLostReasonRepo.findById(id, organizationId);
    if (!reason) {
      throw new ErrorResponse("Lead lost reason not found", statusCode.Not_Found);
    }
    const leadCount = await leadLostReasonRepo.countLeadUsage(id, organizationId);
    return { ...reason, _count: { leads: leadCount } };
  }

  /**
   * Update reason
   */
  async updateReason(id: string, organizationId: string, data: UpdateLeadLostReasonInput) {
    const existing = await leadLostReasonRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead lost reason not found", statusCode.Not_Found);
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await leadLostReasonRepo.findByName(data.name, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A lead lost reason with this name already exists", statusCode.Conflict);
      }
    }

    if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const duplicate = await leadLostReasonRepo.findBySlug(data.slug, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A lead lost reason with this slug already exists", statusCode.Conflict);
      }
    }

    return leadLostReasonRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete reason (safely checks if leads are actively using it)
   */
  async deleteReason(id: string, organizationId: string) {
    const existing = await leadLostReasonRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Lead lost reason not found", statusCode.Not_Found);
    }

    if (existing.isSystem) {
      throw new ErrorResponse("Core system lost reasons cannot be deleted. Deactivate instead.", statusCode.Forbidden);
    }

    const leadCount = await leadLostReasonRepo.countLeadUsage(id, organizationId);
    if (leadCount > 0) {
      throw new ErrorResponse(
        `Cannot delete this lost reason because it is currently linked to ${leadCount} lead(s). Deactivate it instead.`,
        statusCode.Conflict
      );
    }

    return leadLostReasonRepo.softDelete(id, organizationId);
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const updated = await leadLostReasonRepo.toggleActive(id, organizationId);
    if (!updated) {
      throw new ErrorResponse("Lead lost reason not found", statusCode.Not_Found);
    }
    return updated;
  }
}

export const leadLostReasonService = new LeadLostReasonService();
