import { leadFunnelRepo } from "../repos/lead-funnel.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateLeadFunnelInput,
  UpdateLeadFunnelInput,
  GetLeadFunnelsQueryInput,
  CreateFunnelStageInput,
  UpdateFunnelStageInput,
  CreateFormFieldInput,
  UpdateFormFieldInput,
  SubmitPublicLeadInput,
} from "../validators/lead-funnel.validator.js";

/**
 * Service: Multi-Funnel Architecture & Dynamic Form Management
 */
export class LeadFunnelService {
  /**
   * Get all funnels for an organization, auto-seeding default templates if none exist
   */
  async getFunnels(organizationId: string, query: GetLeadFunnelsQueryInput) {
    // Auto-seed default funnels if organization has none
    await leadFunnelRepo.seedDefaultFunnels(organizationId);
    return leadFunnelRepo.findAll(organizationId, query);
  }

  /**
   * Get funnel by ID
   */
  async getFunnelById(id: string, organizationId: string) {
    const funnel = await leadFunnelRepo.findById(id, organizationId);
    if (!funnel) {
      throw new ErrorResponse("Lead funnel not found", statusCode.Not_Found);
    }
    return funnel;
  }

  /**
   * Create a new Lead Funnel
   */
  async createFunnel(organizationId: string, data: CreateLeadFunnelInput) {
    return leadFunnelRepo.create(organizationId, data);
  }

  /**
   * Update an existing Lead Funnel
   */
  async updateFunnel(id: string, organizationId: string, data: UpdateLeadFunnelInput) {
    await this.getFunnelById(id, organizationId);
    return leadFunnelRepo.update(id, organizationId, data);
  }

  /**
   * Delete a Lead Funnel
   */
  async deleteFunnel(id: string, organizationId: string) {
    await this.getFunnelById(id, organizationId);
    return leadFunnelRepo.delete(id, organizationId);
  }

  // ==========================================
  // STAGES OPERATIONS
  // ==========================================

  /**
   * Add stage to funnel
   */
  async addStage(funnelId: string, organizationId: string, data: CreateFunnelStageInput) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.addStage(funnelId, organizationId, data);
  }

  /**
   * Update stage in funnel
   */
  async updateStage(stageId: string, funnelId: string, organizationId: string, data: UpdateFunnelStageInput) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.updateStage(stageId, funnelId, organizationId, data);
  }

  /**
   * Delete stage from funnel
   */
  async deleteStage(stageId: string, funnelId: string, organizationId: string) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.deleteStage(stageId, funnelId, organizationId);
  }

  /**
   * Reorder stages in funnel
   */
  async reorderStages(funnelId: string, organizationId: string, stages: { id: string; orderIndex: number }[]) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.reorderStages(funnelId, organizationId, stages);
  }

  // ==========================================
  // DYNAMIC FORM BUILDER OPERATIONS
  // ==========================================

  /**
   * Add dynamic form field
   */
  async addFormField(funnelId: string, organizationId: string, data: CreateFormFieldInput) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.addFormField(funnelId, organizationId, data);
  }

  /**
   * Update dynamic form field
   */
  async updateFormField(fieldId: string, funnelId: string, organizationId: string, data: UpdateFormFieldInput) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.updateFormField(fieldId, funnelId, organizationId, data);
  }

  /**
   * Delete dynamic form field
   */
  async deleteFormField(fieldId: string, funnelId: string, organizationId: string) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.deleteFormField(fieldId, funnelId, organizationId);
  }

  /**
   * Reorder dynamic form fields
   */
  async reorderFormFields(funnelId: string, organizationId: string, fields: { id: string; orderIndex: number }[]) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.reorderFormFields(funnelId, organizationId, fields);
  }

  // ==========================================
  // PUBLIC EMBED OPERATIONS
  // ==========================================

  /**
   * Get public embed definition (scoped by organization if provided)
   */
  async getPublicEmbedFunnel(embedSlug: string, orgSlugOrId?: string) {
    const funnel = orgSlugOrId
      ? await leadFunnelRepo.findByOrgAndEmbedSlug(orgSlugOrId, embedSlug)
      : await leadFunnelRepo.findByEmbedSlug(embedSlug);

    if (!funnel) {
      throw new ErrorResponse("Public embed form not found or inactive", statusCode.Not_Found);
    }
    return funnel;
  }

  /**
   * Submit lead via public embed form (scoped by organization if provided)
   */
  async submitPublicEmbedLead(embedSlug: string, data: SubmitPublicLeadInput, orgSlugOrId?: string) {
    if (orgSlugOrId) {
      return leadFunnelRepo.submitPublicLead(orgSlugOrId, embedSlug, data);
    }
    return leadFunnelRepo.submitPublicLead(embedSlug, data);
  }

  // ==========================================
  // INQUIRIES & TRANSITION AUDIT OPERATIONS
  // ==========================================

  /**
   * Get paginated leads/inquiries captured under this funnel
   */
  async getFunnelLeads(funnelId: string, organizationId: string, query: any) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.findFunnelLeads(funnelId, organizationId, query);
  }

  /**
   * Transition lead stage within the funnel
   */
  async transitionLeadStage(
    funnelId: string,
    leadId: string,
    organizationId: string,
    data: any,
    userId?: string
  ) {
    return leadFunnelRepo.transitionLeadStage(funnelId, leadId, organizationId, data, userId);
  }

  /**
   * Get funnel transitions & SLA audit logs
   */
  async getFunnelTransitions(funnelId: string, organizationId: string, query: any) {
    await this.getFunnelById(funnelId, organizationId);
    return leadFunnelRepo.findFunnelTransitions(funnelId, organizationId, query);
  }

  /**
   * Get all stage transitions for a specific lead
   */
  async getLeadTransitions(leadId: string, organizationId: string) {
    return leadFunnelRepo.findLeadTransitions(leadId, organizationId);
  }
}

export const leadFunnelService = new LeadFunnelService();
