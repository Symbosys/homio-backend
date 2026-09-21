import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { progressRepo } from "../repos/progress.repo.js";
import type {
  CreateProgressInput,
  UpdateProgressInput,
  ReviewProgressInput,
  GetProgressQueryInput,
} from "../validators/progress.validator.js";

export class ProgressService {
  /**
   * Submit a daily site progress log
   */
  async createProgress(
    projectId: string,
    organizationId: string,
    data: CreateProgressInput,
    userId?: string
  ) {
    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. If Milestone is supplied, verify it belongs to this Project
    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: {
          id: data.milestoneId,
          projectId,
          isDeleted: false,
        },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found under this project", statusCode.Not_Found);
      }
    }

    // 3. If submittedById is supplied, verify Employee belongs to this Organization
    if (data.submittedById) {
      const employee = await prisma.employee.findFirst({
        where: {
          id: data.submittedById,
          organizationId,
          isDeleted: false,
        },
      });
      if (!employee) {
        throw new ErrorResponse("Submitting employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return progressRepo.create(projectId, data);
  }

  /**
   * List paginated progress logs for a project
   */
  async getProgressList(
    projectId: string,
    organizationId: string,
    query: GetProgressQueryInput
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    return progressRepo.findAll(projectId, query);
  }

  /**
   * Get single progress log by ID
   */
  async getProgressById(
    id: string,
    projectId: string,
    organizationId: string
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const progress = await progressRepo.findById(id, projectId);
    if (!progress) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    return progress;
  }

  /**
   * Update progress log
   */
  async updateProgress(
    id: string,
    projectId: string,
    organizationId: string,
    data: UpdateProgressInput
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await progressRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    // If milestone is updated, verify it belongs to project
    if (data.milestoneId && data.milestoneId !== existing.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: {
          id: data.milestoneId,
          projectId,
          isDeleted: false,
        },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found under this project", statusCode.Not_Found);
      }
    }

    return progressRepo.update(id, projectId, data);
  }

  /**
   * Review & approve/reject site progress report
   */
  async reviewProgress(
    id: string,
    projectId: string,
    organizationId: string,
    data: ReviewProgressInput,
    user?: { id?: string }
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await progressRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    // Find reviewing employee if user has an associated Employee profile
    let approvedEmployeeId: string | undefined;
    if (user?.id) {
      const employee = await prisma.employee.findFirst({
        where: {
          userId: user.id,
          organizationId,
          isDeleted: false,
        },
        select: { id: true },
      });
      if (employee) {
        approvedEmployeeId = employee.id;
      }
    }

    return progressRepo.review(
      id,
      projectId,
      data.approvalStatus,
      approvedEmployeeId,
      data.rejectionReason
    );
  }

  /**
   * Soft delete progress log
   */
  async deleteProgress(
    id: string,
    projectId: string,
    organizationId: string
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await progressRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    return progressRepo.softDelete(id, projectId);
  }
}

export const progressService = new ProgressService();
