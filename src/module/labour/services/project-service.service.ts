import { projectServiceRepo } from "../repos/project-service.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateProjectServiceInput,
  UpdateProjectServiceInput,
  GetProjectServicesQuery,
} from "../validators/project-service.validator.js";

/**
 * Project Service Service
 * Business logic for Project Services, workforce allocation scoping, and status management.
 */
export class ProjectServiceService {
  /**
   * Create a new Project Service
   */
  async createService(
    payload: CreateProjectServiceInput,
    organizationId: string
  ) {
    // 1. Verify project belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: payload.projectId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!project) {
      throw new ErrorResponse(
        "Project not found or unauthorized",
        statusCode.Not_Found
      );
    }

    // 2. Verify supervisor belongs to tenant (if provided)
    if (payload.supervisorId) {
      const supervisor = await prisma.employee.findFirst({
        where: {
          id: payload.supervisorId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!supervisor) {
        throw new ErrorResponse(
          "Supervisor employee not found or unauthorized",
          statusCode.Not_Found
        );
      }
    }

    // 3. Generate sequential service code (SRV-YYYY-NNNN)
    const serviceCode = await projectServiceRepo.generateServiceCode(
      organizationId
    );

    return projectServiceRepo.create(
      {
        ...payload,
        serviceCode,
      },
      organizationId
    );
  }

  /**
   * Get single Project Service by ID
   */
  async getServiceById(id: string, organizationId: string) {
    const service = await projectServiceRepo.findById(id, organizationId);
    if (!service) {
      throw new ErrorResponse(
        "Project service not found or unauthorized",
        statusCode.Not_Found
      );
    }
    return service;
  }

  /**
   * Get all paginated Project Services with filters
   */
  async getServices(query: GetProjectServicesQuery, organizationId: string) {
    return projectServiceRepo.findAll(query, organizationId);
  }

  /**
   * Full symmetric update of Project Service
   */
  async updateService(
    id: string,
    payload: UpdateProjectServiceInput,
    organizationId: string
  ) {
    // 1. Verify service exists
    await this.getServiceById(id, organizationId);

    // 2. Verify project if changed
    if (payload.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: payload.projectId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!project) {
        throw new ErrorResponse(
          "Target project not found or unauthorized",
          statusCode.Not_Found
        );
      }
    }

    // 3. Verify supervisor if changed
    if (payload.supervisorId) {
      const supervisor = await prisma.employee.findFirst({
        where: {
          id: payload.supervisorId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!supervisor) {
        throw new ErrorResponse(
          "Supervisor employee not found or unauthorized",
          statusCode.Not_Found
        );
      }
    }

    return projectServiceRepo.update(id, payload, organizationId);
  }

  /**
   * Update status of Project Service
   */
  async updateServiceStatus(
    id: string,
    status: string,
    organizationId: string
  ) {
    await this.getServiceById(id, organizationId);
    return projectServiceRepo.updateStatus(id, status, organizationId);
  }

  /**
   * Soft delete Project Service
   */
  async deleteService(id: string, organizationId: string) {
    await this.getServiceById(id, organizationId);
    return projectServiceRepo.delete(id, organizationId);
  }
}

export const projectServiceService = new ProjectServiceService();
