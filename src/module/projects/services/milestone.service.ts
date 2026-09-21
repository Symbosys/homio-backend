import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { milestoneRepo } from "../repos/milestone.repo.js";
import type {
  CreateMilestoneInput,
  UpdateMilestoneInput,
  GetMilestonesQueryInput,
} from "../validators/milestone.validator.js";

export class MilestoneService {
  /**
   * Create a milestone under a project
   */
  async createMilestone(
    projectId: string,
    organizationId: string,
    data: CreateMilestoneInput,
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

    // 2. Verify Assignee belongs to Organization if supplied
    if (data.assigneeId) {
      const assignee = await prisma.employee.findFirst({
        where: {
          id: data.assigneeId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!assignee) {
        throw new ErrorResponse(
          "Assignee employee not found in this organization",
          statusCode.Bad_Request,
        );
      }
    }

    // 3. Generate sequential code if omitted
    let milestoneCode = data.milestoneCode;
    if (!milestoneCode || milestoneCode.trim() === "") {
      milestoneCode = await milestoneRepo.generateMilestoneCode(projectId);
    } else {
      const existing = await prisma.projectMilestone.findFirst({
        where: {
          projectId,
          milestoneCode,
          isDeleted: false,
        },
      });
      if (existing) {
        throw new ErrorResponse(
          `Milestone code '${milestoneCode}' already exists in this project`,
          statusCode.Conflict,
        );
      }
    }

    return milestoneRepo.create(projectId, { ...data, milestoneCode });
  }

  /**
   * Get all milestones for a project
   */
  async getMilestones(
    projectId: string,
    organizationId: string,
    query: GetMilestonesQueryInput,
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

    return milestoneRepo.findAll(projectId, query);
  }

  /**
   * Get single milestone by ID
   */
  async getMilestoneById(
    id: string,
    projectId: string,
    organizationId: string,
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

    const milestone = await milestoneRepo.findById(id, projectId);
    if (!milestone) {
      throw new ErrorResponse("Milestone not found", statusCode.Not_Found);
    }

    return milestone;
  }

  /**
   * Update milestone properties and sync checklist items
   */
  async updateMilestone(
    id: string,
    projectId: string,
    organizationId: string,
    data: UpdateMilestoneInput,
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

    const existing = await milestoneRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Milestone not found", statusCode.Not_Found);
    }

    // Verify Assignee if updated
    if (data.assigneeId && data.assigneeId !== existing.assigneeId) {
      const assignee = await prisma.employee.findFirst({
        where: {
          id: data.assigneeId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!assignee) {
        throw new ErrorResponse(
          "Assignee employee not found in this organization",
          statusCode.Bad_Request,
        );
      }
    }

    // Verify code uniqueness if updated
    if (data.milestoneCode && data.milestoneCode !== existing.milestoneCode) {
      const duplicate = await prisma.projectMilestone.findFirst({
        where: {
          projectId,
          milestoneCode: data.milestoneCode,
          id: { not: id },
          isDeleted: false,
        },
      });
      if (duplicate) {
        throw new ErrorResponse(
          `Milestone code '${data.milestoneCode}' already exists in this project`,
          statusCode.Conflict,
        );
      }
    }

    return milestoneRepo.update(id, projectId, data);
  }

  /**
   * Toggle checklist item state and auto-update milestone completion percentage
   */
  async toggleChecklist(
    checklistId: string,
    milestoneId: string,
    projectId: string,
    organizationId: string,
    isCompleted?: boolean,
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

    const milestone = await milestoneRepo.findById(milestoneId, projectId);
    if (!milestone) {
      throw new ErrorResponse("Milestone not found", statusCode.Not_Found);
    }

    const updatedChecklist = await milestoneRepo.toggleChecklist(
      checklistId,
      milestoneId,
      isCompleted,
    );
    if (!updatedChecklist) {
      throw new ErrorResponse(
        "Checklist item not found in this milestone",
        statusCode.Not_Found,
      );
    }

    // Calculate updated completion percentage
    const allChecklists = await prisma.milestoneChecklist.findMany({
      where: { milestoneId },
    });
    const completedCount = allChecklists.filter((c) => c.isCompleted).length;
    const completionPercent =
      allChecklists.length > 0
        ? (completedCount / allChecklists.length) * 100
        : 0;

    await prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        completionPercent,
        status:
          completionPercent === 100
            ? "COMPLETED"
            : completionPercent > 0
              ? "IN_PROGRESS"
              : milestone.status,
      },
    });

    return updatedChecklist;
  }

  /**
   * Soft delete milestone
   */
  async deleteMilestone(id: string, projectId: string, organizationId: string) {
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

    const existing = await milestoneRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Milestone not found", statusCode.Not_Found);
    }

    return milestoneRepo.softDelete(id, projectId);
  }
}

export const milestoneService = new MilestoneService();
