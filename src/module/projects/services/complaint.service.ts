import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { complaintRepo } from "../repos/complaint.repo.js";
import type {
  CreateComplaintInput,
  UpdateComplaintInput,
  UpdateComplaintStatusInput,
  AddComplaintCommentInput,
  GetComplaintsQueryInput,
  GetOrgComplaintsQueryInput,
} from "../validators/complaint.validator.js";

export class ComplaintService {
  /**
   * File a complaint under a project
   */
  async createComplaint(projectId: string, organizationId: string, data: CreateComplaintInput) {
    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Verify Customer reporter if supplied
    if (data.reportedByCustomerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: data.reportedByCustomerId, organizationId, isDeleted: false },
      });
      if (!customer) {
        throw new ErrorResponse("Reporting customer not found in this organization", statusCode.Bad_Request);
      }
    }

    // 3. Verify Employee reporter if supplied
    if (data.reportedByEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.reportedByEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Reporting employee not found in this organization", statusCode.Bad_Request);
      }
    }

    // 4. Verify Assignee if supplied
    if (data.assignedToId) {
      const assignee = await prisma.employee.findFirst({
        where: { id: data.assignedToId, organizationId, isDeleted: false },
      });
      if (!assignee) {
        throw new ErrorResponse("Assignee employee not found in this organization", statusCode.Bad_Request);
      }
    }

    // 5. Verify Milestone if supplied
    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
      }
    }

    const complaint = await complaintRepo.create(projectId, data);

    // Auto-create timeline event for complaint logged
    await prisma.projectTimeline
      .create({
        data: {
          projectId,
          title: `Complaint/Snag Logged: ${complaint.title}`,
          description: complaint.description || `Issue reported with priority ${complaint.priority}.`,
          eventType: "OTHER",
          category: "COMPLAINT",
          status: "IN_PROGRESS",
          performedById: complaint.assignedToId || null,
          isCustom: false,
          isSystemGenerated: true,
        },
      })
      .catch(() => {});

    return complaint;
  }

  /**
   * Get paginated list of complaints for a project
   */
  async getComplaints(projectId: string, organizationId: string, query: GetComplaintsQueryInput) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    return complaintRepo.findAll(projectId, query);
  }

  /**
   * Get single complaint by ID with full details
   */
  async getComplaintById(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const complaint = await complaintRepo.findById(id, projectId);
    if (!complaint) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    return complaint;
  }

  /**
   * Update complaint details
   */
  async updateComplaint(id: string, projectId: string, organizationId: string, data: UpdateComplaintInput) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await complaintRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    if (data.assignedToId && data.assignedToId !== existing.assignedToId) {
      const assignee = await prisma.employee.findFirst({
        where: { id: data.assignedToId, organizationId, isDeleted: false },
      });
      if (!assignee) {
        throw new ErrorResponse("Assignee employee not found in this organization", statusCode.Bad_Request);
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

    return complaintRepo.update(id, projectId, data);
  }

  /**
   * Update complaint status and lifecycle fields
   */
  async updateComplaintStatus(
    id: string,
    projectId: string,
    organizationId: string,
    data: UpdateComplaintStatusInput
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await complaintRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    if (data.assignedToId) {
      const assignee = await prisma.employee.findFirst({
        where: { id: data.assignedToId, organizationId, isDeleted: false },
      });
      if (!assignee) {
        throw new ErrorResponse("Assignee employee not found in this organization", statusCode.Bad_Request);
      }
    }

    if (data.resolvedById) {
      const resolver = await prisma.employee.findFirst({
        where: { id: data.resolvedById, organizationId, isDeleted: false },
      });
      if (!resolver) {
        throw new ErrorResponse("Resolver employee not found in this organization", statusCode.Bad_Request);
      }
    }

    const updated = await complaintRepo.updateStatus(id, projectId, data);

    // Auto-create timeline event when complaint is resolved or closed
    if (data.status && data.status !== existing.status) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId,
            title: `Complaint Status: ${data.status} (${existing.title})`,
            description: data.resolutionNotes || `Complaint status was updated to ${data.status}.`,
            eventType: "OTHER",
            category: "COMPLAINT",
            status: data.status === "RESOLVED" || data.status === "CLOSED" ? "COMPLETED" : "IN_PROGRESS",
            performedById: data.resolvedById || updated.assignedToId || null,
            isCustom: false,
            isSystemGenerated: true,
          },
        })
        .catch(() => {});
    }

    return updated;
  }

  /**
   * Soft delete complaint
   */
  async deleteComplaint(id: string, projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const existing = await complaintRepo.findById(id, projectId);
    if (!existing) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    return complaintRepo.softDelete(id, projectId);
  }

  // ==========================================
  // COMPLAINT COMMENTS OPERATIONS
  // ==========================================

  /**
   * Add a comment to a complaint
   */
  async addComment(
    projectId: string,
    complaintId: string,
    organizationId: string,
    data: AddComplaintCommentInput
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const complaint = await complaintRepo.findById(complaintId, projectId);
    if (!complaint) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    return complaintRepo.addComment(complaintId, data);
  }

  /**
   * Get all comments for a complaint
   */
  async getComments(projectId: string, complaintId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    const complaint = await complaintRepo.findById(complaintId, projectId);
    if (!complaint) {
      throw new ErrorResponse("Complaint not found", statusCode.Not_Found);
    }

    return complaintRepo.findComments(complaintId);
  }

  // ==========================================
  // SEPARATE ORGANIZATION-WIDE APIS
  // ==========================================

  /**
   * List all complaints across the organization with optional project filter
   */
  async getComplaintsByOrganization(organizationId: string, query: GetOrgComplaintsQueryInput) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return complaintRepo.findAllByOrganization(organizationId, query);
  }
}

export const complaintService = new ComplaintService();
