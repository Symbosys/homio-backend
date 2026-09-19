import { performanceReviewRepo } from "../repos/performance-review.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreatePerformanceReviewInput,
  GetPerformanceReviewsQueryInput,
  UpdatePerformanceReviewInput,
} from "../validators/performance-review.validator.js";

export class PerformanceReviewService {
  /**
   * Helper: Resolve employee profile for current logged-in user
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Employee profile not found for your user account", statusCode.Forbidden);
    }
    return employee;
  }

  /**
   * Submit or record a performance review scorecard
   */
  async createReview(
    organizationId: string,
    reviewerUserId: string,
    input: CreatePerformanceReviewInput
  ) {
    // Verify employee exists and belongs to the caller's organization
    const employee = await prisma.employee.findFirst({
      where: { id: input.employeeId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Target employee not found in your organization", statusCode.Not_Found);
    }

    // Resolve reviewer's employee ID if available
    const reviewerEmployee = await prisma.employee.findFirst({
      where: { userId: reviewerUserId, organizationId, isDeleted: false },
    });

    const reviewDate = input.reviewDate ? new Date(`${input.reviewDate}T00:00:00.000Z`) : new Date();

    return performanceReviewRepo.create({
      employeeId: input.employeeId,
      reviewerId: reviewerEmployee?.id || null,
      reviewPeriod: input.reviewPeriod,
      reviewType: input.reviewType,
      reviewDate,
      overallScore: input.overallScore,
      kpiScores: input.kpiScores || {},
      selfReviewComments: input.selfReviewComments,
      reviewerComments: input.reviewerComments,
      recommendation: input.recommendation,
      recommendedHike: input.recommendedHike,
      status: input.status,
    });
  }

  /**
   * Get all performance reviews for organization (Admin / HR)
   */
  async getAllReviews(organizationId: string, filters: GetPerformanceReviewsQueryInput) {
    return performanceReviewRepo.findAll(organizationId, filters);
  }

  /**
   * Get personal reviews for the logged-in employee
   */
  async getMyReviews(organizationId: string, userId: string) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return performanceReviewRepo.findByEmployeeId(employee.id, organizationId);
  }

  /**
   * Get performance review by ID
   */
  async getReviewById(id: string, organizationId: string) {
    const review = await performanceReviewRepo.findById(id, organizationId);
    if (!review) {
      throw new ErrorResponse("Performance review not found", statusCode.Not_Found);
    }
    return review;
  }

  /**
   * Update performance review scorecard
   */
  async updateReview(
    id: string,
    organizationId: string,
    input: UpdatePerformanceReviewInput
  ) {
    const existing = await performanceReviewRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Performance review not found", statusCode.Not_Found);
    }

    return performanceReviewRepo.update(id, input);
  }

  /**
   * Delete performance review
   */
  async deleteReview(id: string, organizationId: string) {
    const existing = await performanceReviewRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Performance review not found", statusCode.Not_Found);
    }

    await performanceReviewRepo.delete(id);
    return { success: true, message: "Performance review deleted successfully" };
  }
}

export const performanceReviewService = new PerformanceReviewService();
