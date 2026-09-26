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
    userId?: string,
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
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
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
        throw new ErrorResponse(
          "Milestone not found under this project",
          statusCode.Not_Found,
        );
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
        throw new ErrorResponse(
          "Submitting employee not found in this organization",
          statusCode.Bad_Request,
        );
      }
    }

    const progress = await progressRepo.create(projectId, data);

    // Auto-create timeline event for progress entry
    const progressPercentText = data.progressPercent !== undefined ? ` (${data.progressPercent}%)` : "";
    await prisma.projectTimeline
      .create({
        data: {
          projectId,
          title: `Site Progress Logged${progressPercentText}`,
          description: data.description || `Daily work progress recorded for date ${new Date(data.progressDate).toLocaleDateString()}.`,
          eventType: "PROGRESS_UPDATE",
          category: "PROGRESS",
          status: "COMPLETED",
          eventDate: new Date(data.progressDate),
          performedById: data.submittedById || null,
          createdById: userId || null,
          isCustom: false,
          isSystemGenerated: true,
        },
      })
      .catch(() => {});

    return progress;
  }

  /**
   * List paginated progress logs for a project
   */
  async getProgressList(
    projectId: string,
    organizationId: string,
    query: GetProgressQueryInput,
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
    }

    return progressRepo.findAll(projectId, query);
  }

  /**
   * Get single progress log by ID
   */
  async getProgressById(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
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
    data: UpdateProgressInput,
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
    }

    const existing = await progressRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    // 24-hour edit window rule: cannot update site progress after 24 hours of submission
    const createdAtTime = new Date(existing.createdAt).getTime();
    const nowTime = Date.now();
    const diffHours = (nowTime - createdAtTime) / (1000 * 60 * 60);

    if (diffHours > 24) {
      throw new ErrorResponse(
        "Site progress cannot be updated after 24 hours of submission",
        statusCode.Bad_Request,
      );
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
        throw new ErrorResponse(
          "Milestone not found under this project",
          statusCode.Not_Found,
        );
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
    user?: { id?: string },
  ) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
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

    const reviewed = await progressRepo.review(
      id,
      projectId,
      data.approvalStatus,
      approvedEmployeeId,
      data.rejectionReason,
    );

    // Auto-create timeline event for progress review
    await prisma.projectTimeline
      .create({
        data: {
          projectId,
          title: `Progress Log ${data.approvalStatus}`,
          description: data.rejectionReason || `Site progress log was reviewed and marked ${data.approvalStatus}.`,
          eventType: "PROGRESS_UPDATE",
          category: "PROGRESS",
          status: data.approvalStatus === "APPROVED" ? "COMPLETED" : "CANCELLED",
          performedById: approvedEmployeeId || null,
          isCustom: false,
          isSystemGenerated: true,
        },
      })
      .catch(() => {});

    return reviewed;
  }

  /**
   * Soft delete progress log
   */
  async deleteProgress(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found in this organization",
        statusCode.Not_Found,
      );
    }

    const existing = await progressRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Progress entry not found", statusCode.Not_Found);
    }

    return progressRepo.softDelete(id, projectId);
  }
}

export const progressService = new ProgressService();
