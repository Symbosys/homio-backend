import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { siteVisitRepo } from "../repos/site-visit.repo.js";
import type {
  CreateSiteVisitInput,
  UpdateSiteVisitInput,
  CompleteSiteVisitInput,
  GetSiteVisitsQuery,
} from "../validators/site-visit.validator.js";

export class SiteVisitService {
  /**
   * Create a Site Visit under a project with strict tenant boundary enforcement
   */
  async createSiteVisit(projectId: string, organizationId: string, data: CreateSiteVisitInput) {
    // 1. Verify Project belongs to Organization
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Verify Milestone belongs to Project if supplied
    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
      }
    }

    // 3. Verify Visitor Employee belongs to Organization if supplied
    if (data.visitorEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.visitorEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Visitor employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return siteVisitRepo.create(projectId, data);
  }

  /**
   * Get paginated list of site visits scoped to organization
   */
  async getSiteVisits(organizationId: string, query: GetSiteVisitsQuery) {
    if (query.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: query.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
      }
    }

    return siteVisitRepo.findAll(organizationId, query);
  }

  /**
   * Get single site visit by ID with tenant verification
   */
  async getSiteVisitById(id: string, organizationId: string) {
    const visit = await siteVisitRepo.findById(id, organizationId);
    if (!visit) {
      throw new ErrorResponse("Site visit not found", statusCode.Not_Found);
    }
    return visit;
  }

  /**
   * Update site visit parameters
   */
  async updateSiteVisit(id: string, organizationId: string, data: UpdateSiteVisitInput) {
    const existing = await siteVisitRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Site visit not found", statusCode.Not_Found);
    }

    if (data.milestoneId) {
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId: existing.projectId, isDeleted: false },
      });
      if (!milestone) {
        throw new ErrorResponse("Milestone not found in this project", statusCode.Bad_Request);
      }
    }

    if (data.visitorEmployeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: data.visitorEmployeeId, organizationId, isDeleted: false },
      });
      if (!employee) {
        throw new ErrorResponse("Visitor employee not found in this organization", statusCode.Bad_Request);
      }
    }

    return siteVisitRepo.update(id, data);
  }

  /**
   * Complete site visit with inspection findings & snags
   */
  async completeSiteVisit(id: string, organizationId: string, data: CompleteSiteVisitInput) {
    const existing = await siteVisitRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Site visit not found", statusCode.Not_Found);
    }

    return siteVisitRepo.complete(id, data);
  }

  /**
   * Soft delete site visit
   */
  async deleteSiteVisit(id: string, organizationId: string) {
    const existing = await siteVisitRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Site visit not found", statusCode.Not_Found);
    }

    return siteVisitRepo.delete(id);
  }
}

export const siteVisitService = new SiteVisitService();
