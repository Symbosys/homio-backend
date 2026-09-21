import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { DesignRepository } from "../repos/design.repo.js";
import type { z } from "zod";
import type {
  createDesignFolderSchema,
  updateDesignFolderSchema,
  getDesignFoldersQuerySchema,
  createProjectDesignSchema,
  updateProjectDesignSchema,
  getProjectDesignsQuerySchema,
  createDesignVersionSchema,
  updateDesignVersionSchema,
  createDesignAttachmentSchema,
  updateDesignAttachmentSchema,
  createDesignApprovalSchema,
  createDesignChangeRequestSchema,
  respondDesignChangeRequestSchema,
  getDesignChangeRequestsQuerySchema,
} from "../validators/design.validator.js";

type CreateFolderInput = z.infer<typeof createDesignFolderSchema>["body"];
type UpdateFolderInput = z.infer<typeof updateDesignFolderSchema>["body"];
type GetFoldersQueryInput = z.infer<typeof getDesignFoldersQuerySchema>["query"];

type CreateDesignInput = z.infer<typeof createProjectDesignSchema>["body"];
type UpdateDesignInput = z.infer<typeof updateProjectDesignSchema>["body"];
type GetDesignsQueryInput = z.infer<typeof getProjectDesignsQuerySchema>["query"];

type CreateVersionInput = z.infer<typeof createDesignVersionSchema>["body"];
type UpdateVersionInput = z.infer<typeof updateDesignVersionSchema>["body"];

type CreateAttachmentInput = z.infer<typeof createDesignAttachmentSchema>["body"];
type UpdateAttachmentInput = z.infer<typeof updateDesignAttachmentSchema>["body"];

type CreateApprovalInput = z.infer<typeof createDesignApprovalSchema>["body"];

type CreateChangeRequestInput = z.infer<typeof createDesignChangeRequestSchema>["body"];
type RespondChangeRequestInput = z.infer<typeof respondDesignChangeRequestSchema>["body"];
type GetChangeRequestsQueryInput = z.infer<typeof getDesignChangeRequestsQuerySchema>["query"];

export const designRepo = new DesignRepository();

export class DesignService {
  /**
   * Helper: Ensure project exists and belongs to the active organization
   */
  private async verifyProject(projectId: string, organizationId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }
    return project;
  }

  // ==========================================================================
  // 1. DESIGN FOLDERS
  // ==========================================================================

  async createFolder(projectId: string, organizationId: string, data: CreateFolderInput) {
    await this.verifyProject(projectId, organizationId);

    // If parent folder supplied, verify parent belongs to this project & tenant
    if (data.parentId) {
      const parent = await prisma.projectDesignFolder.findFirst({
        where: { id: data.parentId, projectId, organizationId, isDeleted: false },
      });
      if (!parent) {
        throw new ErrorResponse("Parent folder not found in this project", statusCode.Bad_Request);
      }
    }

    // Check unique folder name under same parent
    const existing = await prisma.projectDesignFolder.findFirst({
      where: {
        projectId,
        parentId: data.parentId || null,
        name: data.name,
        isDeleted: false,
      },
    });
    if (existing) {
      throw new ErrorResponse("A folder with this name already exists at this hierarchy level", statusCode.Conflict);
    }

    return designRepo.createFolder(organizationId, projectId, data);
  }

  async getFolders(projectId: string, organizationId: string, query: GetFoldersQueryInput) {
    await this.verifyProject(projectId, organizationId);
    return designRepo.findFolders(organizationId, projectId, query);
  }

  async getFolderById(projectId: string, organizationId: string, id: string) {
    await this.verifyProject(projectId, organizationId);
    const folder = await designRepo.findFolderById(organizationId, projectId, id);
    if (!folder) {
      throw new ErrorResponse("Design folder not found", statusCode.Not_Found);
    }
    return folder;
  }

  async updateFolder(projectId: string, organizationId: string, id: string, data: UpdateFolderInput) {
    await this.verifyProject(projectId, organizationId);
    const existing = await designRepo.findFolderById(organizationId, projectId, id);
    if (!existing) {
      throw new ErrorResponse("Design folder not found", statusCode.Not_Found);
    }

    if (data.parentId && data.parentId === id) {
      throw new ErrorResponse("Folder cannot be its own parent", statusCode.Bad_Request);
    }

    if (data.parentId) {
      const parent = await prisma.projectDesignFolder.findFirst({
        where: { id: data.parentId, projectId, organizationId, isDeleted: false },
      });
      if (!parent) {
        throw new ErrorResponse("Parent folder not found in this project", statusCode.Bad_Request);
      }
    }

    return designRepo.updateFolder(organizationId, projectId, id, data);
  }

  async deleteFolder(projectId: string, organizationId: string, id: string) {
    await this.verifyProject(projectId, organizationId);
    const existing = await designRepo.findFolderById(organizationId, projectId, id);
    if (!existing) {
      throw new ErrorResponse("Design folder not found", statusCode.Not_Found);
    }
    return designRepo.deleteFolder(id);
  }

  // ==========================================================================
  // 2. MASTER DESIGNS
  // ==========================================================================

  async createDesign(projectId: string, organizationId: string, data: CreateDesignInput) {
    await this.verifyProject(projectId, organizationId);

    // Verify folder belongs to project if supplied
    if (data.folderId) {
      const folder = await prisma.projectDesignFolder.findFirst({
        where: { id: data.folderId, projectId, organizationId, isDeleted: false },
      });
      if (!folder) {
        throw new ErrorResponse("Target design folder not found in this project", statusCode.Bad_Request);
      }
    }

    // Verify milestone belongs to project if supplied
    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Target milestone not found in this project", statusCode.Bad_Request);
      }
    }

    // Verify creator employee if supplied
    if (data.createdById) {
      const creator = await prisma.employee.findFirst({
        where: { id: data.createdById, organizationId, isDeleted: false },
      });
      if (!creator) {
        throw new ErrorResponse("Creator employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return designRepo.createDesign(organizationId, projectId, data);
  }

  async getDesigns(projectId: string, organizationId: string, query: GetDesignsQueryInput) {
    await this.verifyProject(projectId, organizationId);
    return designRepo.findDesigns(organizationId, projectId, query);
  }

  async getDesignById(projectId: string, organizationId: string, id: string) {
    await this.verifyProject(projectId, organizationId);
    const design = await designRepo.findDesignById(organizationId, projectId, id);
    if (!design) {
      throw new ErrorResponse("Design asset not found", statusCode.Not_Found);
    }
    return design;
  }

  async updateDesign(projectId: string, organizationId: string, id: string, data: UpdateDesignInput) {
    await this.verifyProject(projectId, organizationId);
    const existing = await designRepo.findDesignById(organizationId, projectId, id);
    if (!existing) {
      throw new ErrorResponse("Design asset not found", statusCode.Not_Found);
    }

    if (data.folderId) {
      const folder = await prisma.projectDesignFolder.findFirst({
        where: { id: data.folderId, projectId, organizationId, isDeleted: false },
      });
      if (!folder) {
        throw new ErrorResponse("Target design folder not found in this project", statusCode.Bad_Request);
      }
    }

    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Target milestone not found in this project", statusCode.Bad_Request);
      }
    }

    return designRepo.updateDesign(id, data);
  }

  async deleteDesign(projectId: string, organizationId: string, id: string) {
    await this.verifyProject(projectId, organizationId);
    const existing = await designRepo.findDesignById(organizationId, projectId, id);
    if (!existing) {
      throw new ErrorResponse("Design asset not found", statusCode.Not_Found);
    }
    return designRepo.deleteDesign(id);
  }

  // ==========================================================================
  // 3. DESIGN VERSIONS
  // ==========================================================================

  async createVersion(projectId: string, organizationId: string, designId: string, data: CreateVersionInput) {
    await this.verifyProject(projectId, organizationId);
    const design = await designRepo.findDesignById(organizationId, projectId, designId);
    if (!design) {
      throw new ErrorResponse("Design asset not found", statusCode.Not_Found);
    }

    if (data.submittedById) {
      const submitter = await prisma.employee.findFirst({
        where: { id: data.submittedById, organizationId, isDeleted: false },
      });
      if (!submitter) {
        throw new ErrorResponse("Submitter employee not found in this organization", statusCode.Bad_Request);
      }
    }

    // Determine next sequential version number
    const maxVersion = await prisma.designVersion.aggregate({
      where: { designId },
      _max: { versionNumber: true },
    });
    const nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;

    return designRepo.createVersion(designId, data, nextVersionNumber);
  }

  async getVersions(projectId: string, organizationId: string, designId: string) {
    await this.verifyProject(projectId, organizationId);
    const design = await designRepo.findDesignById(organizationId, projectId, designId);
    if (!design) {
      throw new ErrorResponse("Design asset not found", statusCode.Not_Found);
    }
    return designRepo.findVersions(designId);
  }

  async getVersionById(projectId: string, organizationId: string, designId: string, versionId: string) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }
    return version;
  }

  async updateVersion(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    data: UpdateVersionInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    if (version.isLocked) {
      throw new ErrorResponse("This design version is approved and locked. Create a new version for modifications.", statusCode.Conflict);
    }

    return designRepo.updateVersion(versionId, data);
  }

  async submitVersion(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    submittedById?: string | null,
    submissionNotes?: string | null
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    if (version.isLocked) {
      throw new ErrorResponse("Version is already approved and locked", statusCode.Conflict);
    }

    if (submittedById) {
      const submitter = await prisma.employee.findFirst({
        where: { id: submittedById, organizationId, isDeleted: false },
      });
      if (!submitter) {
        throw new ErrorResponse("Submitter employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return designRepo.submitVersion(versionId, designId, submittedById, submissionNotes);
  }

  // ==========================================================================
  // 4. ATTACHMENTS
  // ==========================================================================

  async createAttachment(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    data: CreateAttachmentInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    if (version.isLocked) {
      throw new ErrorResponse("Cannot add attachments to an approved, locked version. Create a new version revision.", statusCode.Conflict);
    }

    return designRepo.createAttachment(versionId, data);
  }

  async getAttachments(projectId: string, organizationId: string, designId: string, versionId: string) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }
    return designRepo.findAttachments(versionId);
  }

  async updateAttachment(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    attachmentId: string,
    data: UpdateAttachmentInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    if (version.isLocked) {
      throw new ErrorResponse("Cannot modify attachments of an approved, locked version", statusCode.Conflict);
    }

    const attachment = await designRepo.findAttachmentById(versionId, attachmentId);
    if (!attachment) {
      throw new ErrorResponse("Attachment not found in this version", statusCode.Not_Found);
    }

    return designRepo.updateAttachment(versionId, attachmentId, data);
  }

  async deleteAttachment(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    attachmentId: string
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    if (version.isLocked) {
      throw new ErrorResponse("Cannot delete attachments from an approved, locked version", statusCode.Conflict);
    }

    const attachment = await designRepo.findAttachmentById(versionId, attachmentId);
    if (!attachment) {
      throw new ErrorResponse("Attachment not found in this version", statusCode.Not_Found);
    }

    return designRepo.deleteAttachment(attachmentId);
  }

  // ==========================================================================
  // 5. CLIENT APPROVALS
  // ==========================================================================

  async createApproval(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    approvedByUserId: string,
    data: CreateApprovalInput
  ) {
    const project = await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    // Default customerId to project's customerId if not explicitly provided
    const effectiveCustomerId = data.customerId || project.customerId;

    if (data.decision === "REJECTED" && !data.rejectionReason && !data.reviewComments) {
      throw new ErrorResponse("Rejection reason or review comments are required when rejecting a design version", statusCode.Bad_Request);
    }

    return designRepo.createApproval(
      organizationId,
      projectId,
      versionId,
      approvedByUserId,
      {
        ...data,
        customerId: effectiveCustomerId,
      }
    );
  }

  async getApprovals(projectId: string, organizationId: string, designId: string, versionId: string) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }
    return designRepo.findApprovals(versionId);
  }

  // ==========================================================================
  // 6. CHANGE REQUESTS
  // ==========================================================================

  async createChangeRequest(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    requestedByUserId: string | null,
    data: CreateChangeRequestInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }

    // Determine next sequential requestNumber
    const maxRequest = await prisma.designChangeRequest.aggregate({
      where: { designVersionId: versionId },
      _max: { requestNumber: true },
    });
    const nextRequestNumber = (maxRequest._max.requestNumber || 0) + 1;

    return designRepo.createChangeRequest(versionId, requestedByUserId, data, nextRequestNumber);
  }

  async getChangeRequests(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    query: GetChangeRequestsQueryInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const version = await designRepo.findVersionById(designId, versionId);
    if (!version) {
      throw new ErrorResponse("Design version not found", statusCode.Not_Found);
    }
    return designRepo.findChangeRequests(versionId, query);
  }

  async getChangeRequestById(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    changeRequestId: string
  ) {
    await this.verifyProject(projectId, organizationId);
    const changeRequest = await designRepo.findChangeRequestById(versionId, changeRequestId);
    if (!changeRequest) {
      throw new ErrorResponse("Design change request not found", statusCode.Not_Found);
    }
    return changeRequest;
  }

  async respondChangeRequest(
    projectId: string,
    organizationId: string,
    designId: string,
    versionId: string,
    changeRequestId: string,
    data: RespondChangeRequestInput
  ) {
    await this.verifyProject(projectId, organizationId);
    const changeRequest = await designRepo.findChangeRequestById(versionId, changeRequestId);
    if (!changeRequest) {
      throw new ErrorResponse("Design change request not found", statusCode.Not_Found);
    }

    if (data.respondedById) {
      const responder = await prisma.employee.findFirst({
        where: { id: data.respondedById, organizationId, isDeleted: false },
      });
      if (!responder) {
        throw new ErrorResponse("Responder employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return designRepo.respondChangeRequest(changeRequestId, data);
  }
}
