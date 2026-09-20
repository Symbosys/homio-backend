import { leadActivityRepo } from "../repos/lead-activity.repo.js";
import { leadRepo } from "../repos/lead.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { CreateLeadActivityInput } from "../validators/lead-activity.validator.js";

export class LeadActivityService {
  /**
   * Add a new activity log to a lead
   */
  async createActivity(
    organizationId: string,
    leadId: string,
    input: CreateLeadActivityInput
  ) {
    const lead = await leadRepo.findById(leadId, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    return leadActivityRepo.create(organizationId, leadId, input);
  }

  /**
   * Get all activities for a lead
   */
  async getActivitiesByLeadId(leadId: string, organizationId: string) {
    const lead = await leadRepo.findById(leadId, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    return leadActivityRepo.findByLeadId(leadId, organizationId);
  }

  /**
   * Delete an activity by ID
   */
  async deleteActivity(id: string, organizationId: string) {
    await leadActivityRepo.delete(id, organizationId);
    return { message: "Activity deleted successfully" };
  }
}

export const leadActivityService = new LeadActivityService();
