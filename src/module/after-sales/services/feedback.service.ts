import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  feedbackRepository,
  type FeedbackRepository,
} from "../repos/feedback.repo.js";
import type {
  CreateCustomerFeedbackInput,
  UpdateCustomerFeedbackInput,
  EscalateFeedbackInput,
  ResolveEscalationInput,
  GetCustomerFeedbacksQueryInput,
} from "../validators/feedback.validator.js";

export class FeedbackService {
  constructor(private readonly repo: FeedbackRepository = feedbackRepository) {}

  /**
   * Submit customer feedback
   */
  async createFeedback(organizationId: string, input: CreateCustomerFeedbackInput) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found within organization", statusCode.Not_Found);
    }

    if (input.serviceRequestId) {
      const existing = await prisma.customerFeedback.findFirst({
        where: { serviceRequestId: input.serviceRequestId, isDeleted: false },
      });
      if (existing) {
        throw new ErrorResponse(
          "Customer feedback has already been submitted for this service request",
          statusCode.Conflict
        );
      }
    }

    if (input.serviceVisitId) {
      const existing = await prisma.customerFeedback.findFirst({
        where: { serviceVisitId: input.serviceVisitId, isDeleted: false },
      });
      if (existing) {
        throw new ErrorResponse(
          "Customer feedback has already been submitted for this service visit",
          statusCode.Conflict
        );
      }
    }

    return this.repo.create(organizationId, input);
  }

  /**
   * Get single feedback by ID
   */
  async getFeedbackById(organizationId: string, id: string) {
    const feedback = await this.repo.findById(organizationId, id);
    if (!feedback) {
      throw new ErrorResponse("Customer feedback not found", statusCode.Not_Found);
    }
    return feedback;
  }

  /**
   * List paginated customer feedbacks
   */
  async getFeedbacks(organizationId: string, query: GetCustomerFeedbacksQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Update feedback details
   */
  async updateFeedback(
    organizationId: string,
    id: string,
    input: UpdateCustomerFeedbackInput
  ) {
    await this.getFeedbackById(organizationId, id);
    return this.repo.update(organizationId, id, input);
  }

  /**
   * Escalate feedback to management
   */
  async escalateFeedback(
    organizationId: string,
    id: string,
    input: EscalateFeedbackInput
  ) {
    const feedback = await this.getFeedbackById(organizationId, id);
    if (feedback.isEscalated) {
      throw new ErrorResponse("This feedback is already escalated to management", statusCode.Conflict);
    }
    return this.repo.escalate(organizationId, id, input);
  }

  /**
   * Resolve escalation
   */
  async resolveEscalation(
    organizationId: string,
    id: string,
    input: ResolveEscalationInput
  ) {
    const feedback = await this.getFeedbackById(organizationId, id);
    if (!feedback.isEscalated) {
      throw new ErrorResponse("This feedback is not currently escalated", statusCode.Bad_Request);
    }
    return this.repo.resolveEscalation(organizationId, id, input);
  }

  /**
   * Soft delete feedback
   */
  async deleteFeedback(organizationId: string, id: string) {
    await this.getFeedbackById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }
}

export const feedbackService = new FeedbackService();
