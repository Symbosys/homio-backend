import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  retentionRepository,
  type RetentionRepository,
} from "../repos/retention.repo.js";
import type {
  CreateRetentionFollowUpInput,
  UpdateRetentionFollowUpInput,
  LogRetentionCallInput,
  GetRetentionFollowUpsQueryInput,
} from "../validators/retention.validator.js";

export class RetentionService {
  constructor(private readonly repo: RetentionRepository = retentionRepository) {}

  /**
   * Schedule a retention follow-up
   */
  async createFollowUp(organizationId: string, input: CreateRetentionFollowUpInput) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    if (input.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.assignedEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Assigned employee not found within organization", statusCode.Not_Found);
      }
    }

    return this.repo.create(organizationId, input);
  }

  /**
   * Get single retention follow-up by ID
   */
  async getFollowUpById(organizationId: string, id: string) {
    const followUp = await this.repo.findById(organizationId, id);
    if (!followUp) {
      throw new ErrorResponse("Retention follow-up record not found", statusCode.Not_Found);
    }
    return followUp;
  }

  /**
   * List paginated retention follow-ups
   */
  async getFollowUps(organizationId: string, query: GetRetentionFollowUpsQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Partial update retention details
   */
  async updateFollowUp(
    organizationId: string,
    id: string,
    input: UpdateRetentionFollowUpInput
  ) {
    await this.getFollowUpById(organizationId, id);

    if (input.assignedEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.assignedEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Assigned employee not found within organization", statusCode.Not_Found);
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  /**
   * Log completed call outcome
   */
  async logCall(organizationId: string, id: string, input: LogRetentionCallInput) {
    await this.getFollowUpById(organizationId, id);
    return this.repo.logCall(organizationId, id, input);
  }

  /**
   * Soft delete retention record
   */
  async deleteFollowUp(organizationId: string, id: string) {
    await this.getFollowUpById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const retentionService = new RetentionService();
