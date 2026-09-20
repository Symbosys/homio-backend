import { leadFollowUpRepo } from "../repos/lead-followup.repo.js";
import { leadRepo } from "../repos/lead.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateLeadFollowUpInput,
  UpdateLeadFollowUpInput,
  GetFollowUpsQueryInput,
} from "../validators/lead-followup.validator.js";

export class LeadFollowUpService {
  /**
   * Schedule a new follow-up
   */
  async createFollowUp(organizationId: string, input: CreateLeadFollowUpInput) {
    const lead = await leadRepo.findById(input.leadId, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    return leadFollowUpRepo.create(organizationId, input);
  }

  /**
   * Get all follow-ups with filters & pagination
   */
  async getFollowUps(organizationId: string, query: GetFollowUpsQueryInput) {
    return leadFollowUpRepo.findAll(organizationId, query);
  }

  /**
   * Get single follow-up by ID
   */
  async getFollowUpById(id: string, organizationId: string) {
    const followUp = await leadFollowUpRepo.findById(id, organizationId);
    if (!followUp) {
      throw new ErrorResponse("Follow-up not found", statusCode.Not_Found);
    }
    return followUp;
  }

  /**
   * Update or complete follow-up
   */
  async updateFollowUp(
    id: string,
    organizationId: string,
    input: UpdateLeadFollowUpInput
  ) {
    const existing = await leadFollowUpRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Follow-up not found", statusCode.Not_Found);
    }

    return leadFollowUpRepo.update(id, organizationId, input);
  }

  /**
   * Delete follow-up
   */
  async deleteFollowUp(id: string, organizationId: string) {
    const existing = await leadFollowUpRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Follow-up not found", statusCode.Not_Found);
    }

    await leadFollowUpRepo.delete(id, organizationId);
    return { message: "Follow-up deleted successfully" };
  }
}

export const leadFollowUpService = new LeadFollowUpService();
