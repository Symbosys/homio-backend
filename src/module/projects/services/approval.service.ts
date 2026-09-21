import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { approvalRepo } from "../repos/approval.repo.js";
import type {
  CreateApprovalInput,
  UpdateApprovalInput,
  ReviewApprovalInput,
  GetApprovalsQueryInput,
  CreateChangeRequestInput,
  RespondChangeRequestInput,
} from "../validators/approval.validator.js";

export class ApprovalService {
  /**
   * Create a WorkApproval entry under a project
   */
  async createApproval(projectId: string, organizationId: string, data: CreateApprovalInput) {
    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Verify Submitter Employee belongs to Organization if supplied
    if (data.submittedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.submittedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Submitter employee not found in this organization", statusCode.Bad_Request);
      }
    }

    // 3. Verify Milestone belongs to Project if supplied
    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
      }
    }

    return approvalRepo.create(projectId, data);
  }

  /**
   * Get paginated list of approvals for a project
   */
  async getApprovals(projectId: string, organizationId: string, query: GetApprovalsQueryInput) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    return approvalRepo.findAll(projectId, query);
  }

  /**
   * Get single approval by ID with nested change requests
   */
  async getApprovalById(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const approval = await approvalRepo.findById(id, projectId);
    if (!approval) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    return approval;
  }

  /**
   * Update approval details
   */
  async updateApproval(id: string, projectId: string, organizationId: string, data: UpdateApprovalInput) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await approvalRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    if (data.submittedById && data.submittedById !== existing.submittedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.submittedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Submitter employee not found in this organization", statusCode.Bad_Request);
      }
    }

    if (data.milestoneId && data.milestoneId !== existing.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
      }
    }

    return approvalRepo.update(id, projectId, data);
  }

  /**
   * Client review action (APPROVE / REJECT)
   */
  async reviewApproval(id: string, projectId: string, organizationId: string, data: ReviewApprovalInput) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await approvalRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    return approvalRepo.review(id, projectId, data);
  }

  /**
   * Soft delete approval
   */
  async deleteApproval(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await approvalRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    return approvalRepo.softDelete(id, projectId);
  }

  // ==========================================
  // CHANGE REQUESTS OPERATIONS
  // ==========================================

  /**
   * Submit a change request for a WorkApproval
   */
  async createChangeRequest(
    projectId: string,
    approvalId: string,
    organizationId: string,
    data: CreateChangeRequestInput
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const approval = await approvalRepo.findById(approvalId, projectId);
    if (!approval) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    if (data.requestedByCustomerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.requestedByCustomerId, organizationId, isDeleted: false },
      });
      if (!customer) {
        throw new ErrorResponse("Customer not found in this organization", statusCode.Bad_Request);
      }
    }

    return approvalRepo.createChangeRequest(approvalId, data);
  }

  /**
   * List change requests for an approval
   */
  async getChangeRequests(projectId: string, approvalId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const approval = await approvalRepo.findById(approvalId, projectId);
    if (!approval) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    return approvalRepo.findChangeRequests(approvalId);
  }

  /**
   * Respond to a change request (Accept / Reject / Implement)
   */
  async respondChangeRequest(
    projectId: string,
    approvalId: string,
    id: string,
    organizationId: string,
    data: RespondChangeRequestInput
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const approval = await approvalRepo.findById(approvalId, projectId);
    if (!approval) {
      throw new ErrorResponse("Work approval not found", statusCode.Not_Found);
    }

    const changeRequest = await approvalRepo.findChangeRequestById(id, approvalId);
    if (!changeRequest) {
      throw new ErrorResponse("Change request not found", statusCode.Not_Found);
    }

    if (data.respondedById) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.respondedById, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Responder employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return approvalRepo.respondChangeRequest(id, approvalId, data);
  }
}

export const approvalService = new ApprovalService();
