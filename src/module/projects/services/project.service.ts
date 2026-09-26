import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, Prisma } from "../../../types/types.js";
import { projectRepo } from "../repos/project.repo.js";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  GetProjectsQueryInput,
} from "../validators/project.validator.js";

export class ProjectService {
  /**
   * Create a new Project with optional nested sub-components
   */
  async createProject(organizationId: string, data: CreateProjectInput, userId?: string) {
    // 1. Verify Customer exists and belongs to the same Organization
    const customer = await prisma.customer.findFirst({
      where: {
        id: data.customerId,
        organizationId,
        isDeleted: false,
      },
    });
    if (!customer) {
      throw new ErrorResponse("Customer not found in this organization", statusCode.Not_Found);
    }

    // 2. If Lead is provided, verify it belongs to the same Organization
    if (data.leadId) {
      const lead = await prisma.lead.findFirst({
        where: {
          id: data.leadId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!lead) {
        throw new ErrorResponse("Lead not found in this organization", statusCode.Not_Found);
      }
    }

    // 3. If Team Members are supplied, verify all Employees belong to this Organization
    if (data.members && data.members.length > 0) {
      const employeeIds = data.members.map((m) => m.employeeId);
      const uniqueEmployeeIds = Array.from(new Set(employeeIds));

      const employees = await prisma.employee.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          organizationId,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (employees.length !== uniqueEmployeeIds.length) {
        throw new ErrorResponse(
          "One or more assigned team members do not exist in this organization",
          statusCode.Bad_Request
        );
      }
    }

    // 4. Generate sequential Project Code if not supplied
    let projectCode = data.projectCode;
    if (!projectCode || projectCode.trim() === "") {
      projectCode = await projectRepo.generateProjectCode(organizationId);
    } else {
      // Check for code uniqueness within the organization
      const existing = await prisma.project.findFirst({
        where: {
          organizationId,
          projectCode,
          isDeleted: false,
        },
      });
      if (existing) {
        throw new ErrorResponse(
          `Project with code '${projectCode}' already exists in this organization`,
          statusCode.Conflict
        );
      }
    }


    // 6. Execute atomic creation via repository
    const project = await projectRepo.create(organizationId, { ...data, projectCode }, userId);

    // 7. Promote Customer to CLIENT, update alternate contacts/KYC, and record conversion
    const clientAlternatePhone = data.client?.alternatePhone !== undefined ? data.client?.alternatePhone : data.clientAlternatePhone;
    const clientAlternateRelation = data.client?.alternateContactRelation !== undefined ? data.client?.alternateContactRelation : data.clientAlternateRelation;
    const clientPan = data.client?.panNumber !== undefined ? data.client?.panNumber : data.clientPan;
    const clientAadhaar = data.client?.aadhaarNumber !== undefined ? data.client?.aadhaarNumber : data.clientAadhaar;

    const customerUpdateData: Prisma.CustomerUpdateInput = {
      customerType: "CLIENT",
      convertedAt: new Date(),
      ...(data.leadId ? { initialLeadId: data.leadId } : {}),
    };

    if (clientAlternatePhone !== undefined) {
      customerUpdateData.alternatePhone = clientAlternatePhone ? clientAlternatePhone.trim() : null;
    }
    if (clientAlternateRelation !== undefined) {
      customerUpdateData.alternateContactRelation = clientAlternateRelation ? clientAlternateRelation.trim() : null;
    }
    if (clientPan !== undefined) {
      customerUpdateData.panNumber = clientPan ? clientPan.trim().toUpperCase() : null;
    }
    if (clientAadhaar !== undefined) {
      customerUpdateData.aadhaarNumber = clientAadhaar ? clientAadhaar.trim() : null;
    }

    await prisma.customer
      .update({
        where: { id: data.customerId },
        data: customerUpdateData,
      })
      .catch((err) => {
        console.error("Failed to update customer details on project create:", err);
      });

    // 8. If promoted from a Lead, update Lead status to WON and link project
    if (data.leadId) {
      const existingLead = await prisma.lead.findUnique({
        where: { id: data.leadId },
        select: { id: true, status: true, leadCode: true },
      });

      if (existingLead) {
        if (existingLead.status !== "WON") {
          await prisma.leadStageHistory
            .create({
              data: {
                organizationId,
                leadId: data.leadId,
                fromStage: existingLead.status,
                toStage: "WON",
                changedById: userId || null,
                remarks: `Promoted to Project '${project.name}' (${project.projectCode})`,
              },
            })
            .catch(() => {});
        }

        await prisma.lead
          .update({
            where: { id: data.leadId },
            data: {
              status: "WON",
              convertedAt: new Date(),
              convertedProjectId: project.id,
              convertedById: userId || null,
            },
          })
          .catch(() => {});

        await prisma.leadActivity
          .create({
            data: {
              organizationId,
              leadId: data.leadId,
              type: "STATUS_CHANGE",
              title: "Promoted to Project (WON)",
              description: `Lead converted and promoted to Project '${project.name}' (${project.projectCode}).`,
              metadata: {
                projectId: project.id,
                projectCode: project.projectCode,
              },
            },
          })
          .catch(() => {});
      }
    }

    // 9. Record Conversion Activity on Customer
    await prisma.customerActivity
      .create({
        data: {
          organizationId,
          customerId: data.customerId,
          type: "CONVERSION",
          title: "Promoted to Client",
          description: `Customer was converted to Client upon creation of Project '${project.name}' (${project.projectCode}).`,
          metadata: {
            projectId: project.id,
            projectCode: project.projectCode,
            leadId: data.leadId || null,
          },
        },
      })
      .catch(() => {});

    // 10. Auto-create initial project creation timeline event
    await prisma.projectTimeline
      .create({
        data: {
          projectId: project.id,
          title: "Project Created & Initialized",
          description: `Project '${project.name}' (${project.projectCode}) was onboarded and created.`,
          eventType: "PROJECT_CREATED",
          category: "ONBOARDING",
          status: "COMPLETED",
          isCustom: false,
          isSystemGenerated: true,
          createdById: userId || null,
        },
      })
      .catch(() => {});

    return project;
  }

  /**
   * Get paginated projects with filters and full-text search
   */
  async getProjects(organizationId: string, query: GetProjectsQueryInput) {
    return projectRepo.findAll(organizationId, query);
  }

  /**
   * Get single project by ID with full nested details
   */
  async getProjectById(id: string, organizationId: string) {
    const project = await projectRepo.findById(id, organizationId);
    if (!project) {
      throw new ErrorResponse("Project not found", statusCode.Not_Found);
    }
    return project;
  }

  /**
   * Update project and any/all of its segregated sub-components
   */
  async updateProject(id: string, organizationId: string, data: UpdateProjectInput, userId?: string) {
    // 1. Verify Project exists in this organization
    const existing = await projectRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Project not found", statusCode.Not_Found);
    }

    // 2. If Customer is being changed, verify new Customer belongs to this organization
    if (data.customerId && data.customerId !== existing.customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: data.customerId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!customer) {
        throw new ErrorResponse("Customer not found in this organization", statusCode.Not_Found);
      }
    }

    // 3. If Lead is being changed, verify new Lead belongs to this organization
    if (data.leadId && data.leadId !== existing.leadId) {
      const lead = await prisma.lead.findFirst({
        where: {
          id: data.leadId,
          organizationId,
          isDeleted: false,
        },
      });
      if (!lead) {
        throw new ErrorResponse("Lead not found in this organization", statusCode.Not_Found);
      }
    }

    // 4. If Project Code is being updated, ensure uniqueness
    if (data.projectCode && data.projectCode !== existing.projectCode) {
      const duplicateCode = await prisma.project.findFirst({
        where: {
          organizationId,
          projectCode: data.projectCode,
          id: { not: id },
          isDeleted: false,
        },
      });
      if (duplicateCode) {
        throw new ErrorResponse(
          `Project with code '${data.projectCode}' already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    // 5. If Team Members are updated, verify all Employees belong to this Organization
    if (data.members && data.members.length > 0) {
      const employeeIds = data.members.map((m) => m.employeeId);
      const uniqueEmployeeIds = Array.from(new Set(employeeIds));

      const employees = await prisma.employee.findMany({
        where: {
          id: { in: uniqueEmployeeIds },
          organizationId,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (employees.length !== uniqueEmployeeIds.length) {
        throw new ErrorResponse(
          "One or more assigned team members do not exist in this organization",
          statusCode.Bad_Request
        );
      }
    }


    // 7. Update via repository
    const updated = await projectRepo.update(id, organizationId, data, userId);

    // 7b. Update Customer contact / KYC fields if supplied
    const targetCustomerId = data.customerId || existing.customerId;
    const clientAlternatePhone = data.client?.alternatePhone !== undefined ? data.client?.alternatePhone : data.clientAlternatePhone;
    const clientAlternateRelation = data.client?.alternateContactRelation !== undefined ? data.client?.alternateContactRelation : data.clientAlternateRelation;
    const clientPan = data.client?.panNumber !== undefined ? data.client?.panNumber : data.clientPan;
    const clientAadhaar = data.client?.aadhaarNumber !== undefined ? data.client?.aadhaarNumber : data.clientAadhaar;

    const customerUpdateData: Prisma.CustomerUpdateInput = {};
    let shouldUpdateCustomer = false;

    if (clientAlternatePhone !== undefined) {
      customerUpdateData.alternatePhone = clientAlternatePhone ? clientAlternatePhone.trim() : null;
      shouldUpdateCustomer = true;
    }
    if (clientAlternateRelation !== undefined) {
      customerUpdateData.alternateContactRelation = clientAlternateRelation ? clientAlternateRelation.trim() : null;
      shouldUpdateCustomer = true;
    }
    if (clientPan !== undefined) {
      customerUpdateData.panNumber = clientPan ? clientPan.trim().toUpperCase() : null;
      shouldUpdateCustomer = true;
    }
    if (clientAadhaar !== undefined) {
      customerUpdateData.aadhaarNumber = clientAadhaar ? clientAadhaar.trim() : null;
      shouldUpdateCustomer = true;
    }

    if (shouldUpdateCustomer && targetCustomerId) {
      await prisma.customer
        .update({
          where: { id: targetCustomerId },
          data: customerUpdateData,
        })
        .catch((err) => {
          console.error("Failed to update customer details on project update:", err);
        });
    }

    // 8. Auto-create timeline event entries for significant status/stage/health transitions
    if (data.status && data.status !== existing.status) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId: id,
            title: `Project Status: ${data.status}`,
            description: `Project status transitioned from ${existing.status} to ${data.status}.`,
            eventType: "STATUS_CHANGED",
            category: "LIFECYCLE",
            status: "COMPLETED",
            isCustom: false,
            isSystemGenerated: true,
            createdById: userId || null,
          },
        })
        .catch(() => {});
    }

    if (data.designStatus && data.designStatus !== existing.designStatus) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId: id,
            title: `Design Phase Status: ${data.designStatus}`,
            description: `Design status updated to ${data.designStatus}.`,
            eventType: "STATUS_CHANGED",
            category: "DESIGN",
            status: "COMPLETED",
            isCustom: false,
            isSystemGenerated: true,
            createdById: userId || null,
          },
        })
        .catch(() => {});
    }

    if (data.executionStatus && data.executionStatus !== existing.executionStatus) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId: id,
            title: `Execution Phase Status: ${data.executionStatus}`,
            description: `Execution status updated to ${data.executionStatus}.`,
            eventType: "STATUS_CHANGED",
            category: "EXECUTION",
            status: "COMPLETED",
            isCustom: false,
            isSystemGenerated: true,
            createdById: userId || null,
          },
        })
        .catch(() => {});
    }

    if (data.currentStage && data.currentStage !== existing.currentStage) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId: id,
            title: `Stage Transitioned: ${data.currentStage}`,
            description: `Project stage transitioned from ${existing.currentStage} to ${data.currentStage}.`,
            eventType: "STAGE_CHANGED",
            category: "STAGE",
            status: "COMPLETED",
            isCustom: false,
            isSystemGenerated: true,
            createdById: userId || null,
          },
        })
        .catch(() => {});
    }

    if (data.health && data.health !== existing.health) {
      await prisma.projectTimeline
        .create({
          data: {
            projectId: id,
            title: `Health Status: ${data.health}`,
            description: `Project health status transitioned from ${existing.health} to ${data.health}.`,
            eventType: "HEALTH_CHANGED",
            category: "HEALTH",
            status: "COMPLETED",
            isCustom: false,
            isSystemGenerated: true,
            createdById: userId || null,
          },
        })
        .catch(() => {});
    }

    return updated;
  }

  /**
   * Soft delete a project
   */
  async deleteProject(id: string, organizationId: string) {
    const existing = await projectRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Project not found", statusCode.Not_Found);
    }
    return projectRepo.softDelete(id, organizationId);
  }
}

export const projectService = new ProjectService();
