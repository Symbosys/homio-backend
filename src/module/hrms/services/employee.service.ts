import { employeeRepo } from "../repos/employee.repo.js";
import { departmentRepo } from "../repos/department.repo.js";
import { teamRepo } from "../repos/team.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import { prisma } from "../../../lib/prisma.js";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  GetEmployeesQueryInput,
} from "../validators/employee.validator.js";

export class EmployeeService {
  /**
   * Helper: Generate sequential employee code e.g. EMP-0001
   */
  private async generateEmployeeCode(organizationId: string): Promise<string> {
    const count = await employeeRepo.countEmployees(organizationId);
    let nextNum = count + 1;
    let candidateCode = `EMP-${String(nextNum).padStart(4, "0")}`;

    // Ensure uniqueness
    while (await employeeRepo.findByEmployeeCode(candidateCode, organizationId)) {
      nextNum++;
      candidateCode = `EMP-${String(nextNum).padStart(4, "0")}`;
    }

    return candidateCode;
  }

  /**
   * Create an employee with optional avatar upload and tenant validations
   */
  async createEmployee(
    organizationId: string,
    data: CreateEmployeeInput,
    avatarFile?: Express.Multer.File,
    createdById?: string
  ) {
    // 1. Assign or generate employeeCode
    let employeeCode = data.employeeCode?.trim();
    if (!employeeCode) {
      employeeCode = await this.generateEmployeeCode(organizationId);
    } else {
      const existing = await employeeRepo.findByEmployeeCode(employeeCode, organizationId);
      if (existing) {
        throw new ErrorResponse(
          `Employee code "${employeeCode}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    // 2. Validate linked User if provided
    if (data.userId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: data.userId, organizationId, isDeleted: false },
      });
      if (!existingUser) {
        throw new ErrorResponse("Specified user account not found in this organization", statusCode.Not_Found);
      }
      const userAlreadyAssigned = await prisma.employee.findFirst({
        where: { userId: data.userId, isDeleted: false },
      });
      if (userAlreadyAssigned) {
        throw new ErrorResponse("User is already linked to another employee profile", statusCode.Conflict);
      }
    }

    // 3. Validate Reporting Manager if provided
    if (data.reportingManagerId) {
      const manager = await employeeRepo.findById(data.reportingManagerId, organizationId);
      if (!manager) {
        throw new ErrorResponse("Reporting manager not found in this organization", statusCode.Not_Found);
      }
    }

    // 4. Validate Department & Team if provided
    if (data.departmentId) {
      const dept = await departmentRepo.findById(data.departmentId, organizationId);
      if (!dept) {
        throw new ErrorResponse("Selected department not found in this organization", statusCode.Not_Found);
      }
      if (data.teamId) {
        const team = await teamRepo.findById(data.teamId, organizationId);
        if (!team) {
          throw new ErrorResponse("Selected team not found in this organization", statusCode.Not_Found);
        }
        if (team.department.id !== data.departmentId) {
          throw new ErrorResponse("Selected team does not belong to the chosen department", statusCode.Bad_Request);
        }
      }
    } else if (data.teamId) {
      throw new ErrorResponse("Cannot assign a team without selecting a department", statusCode.Bad_Request);
    }

    // 5. Handle avatar upload through multi-cloud storage service
    let avatarUrlData: ImageType | null = null;
    if (avatarFile) {
      const uploadResult = await storageService.upload(
        {
          buffer: avatarFile.buffer,
          originalname: avatarFile.originalname,
          mimetype: avatarFile.mimetype,
          size: avatarFile.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/employees/avatars`,
          resourceType: "image",
        }
      );
      avatarUrlData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return employeeRepo.create(
      organizationId,
      {
        ...data,
        employeeCode,
        ...(avatarUrlData ? { avatarUrl: avatarUrlData } : {}),
      },
      createdById
    );
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(id: string, organizationId: string) {
    const employee = await employeeRepo.findById(id, organizationId);
    if (!employee) {
      throw new ErrorResponse("Employee not found", statusCode.Not_Found);
    }
    return employee;
  }

  /**
   * Get all employees with pagination and filters
   */
  async getAllEmployees(organizationId: string, query: GetEmployeesQueryInput) {
    return employeeRepo.findAll(organizationId, query);
  }

  /**
   * Update employee profile
   */
  async updateEmployee(
    id: string,
    organizationId: string,
    data: UpdateEmployeeInput,
    avatarFile?: Express.Multer.File,
    updatedById?: string
  ) {
    const existing = await employeeRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Employee not found", statusCode.Not_Found);
    }

    // Check unique employee code if modified
    if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
      const duplicateCode = await employeeRepo.findByEmployeeCode(data.employeeCode, organizationId);
      if (duplicateCode) {
        throw new ErrorResponse(
          `Employee code "${data.employeeCode}" is already taken`,
          statusCode.Conflict
        );
      }
    }

    // Prevent reporting manager circular reference / self-reporting
    if (data.reportingManagerId) {
      if (data.reportingManagerId === id) {
        throw new ErrorResponse("An employee cannot report to themselves", statusCode.Bad_Request);
      }
      const manager = await employeeRepo.findById(data.reportingManagerId, organizationId);
      if (!manager) {
        throw new ErrorResponse("Reporting manager not found in this organization", statusCode.Not_Found);
      }
    }

    // Validate Department & Team update if provided
    if (data.departmentId !== undefined) {
      if (data.departmentId !== null) {
        const dept = await departmentRepo.findById(data.departmentId, organizationId);
        if (!dept) {
          throw new ErrorResponse("Selected department not found in this organization", statusCode.Not_Found);
        }
        if (data.teamId) {
          const team = await teamRepo.findById(data.teamId, organizationId);
          if (!team) {
            throw new ErrorResponse("Selected team not found in this organization", statusCode.Not_Found);
          }
          if (team.department.id !== data.departmentId) {
            throw new ErrorResponse("Selected team does not belong to the chosen department", statusCode.Bad_Request);
          }
        }
      } else if (data.teamId) {
        throw new ErrorResponse("Cannot assign a team when clearing department", statusCode.Bad_Request);
      }
    } else if (data.teamId) {
      const currentDeptId = (existing as any).department?.id;
      if (!currentDeptId) {
        throw new ErrorResponse("Cannot assign a team to an employee without an assigned department", statusCode.Bad_Request);
      }
      const team = await teamRepo.findById(data.teamId, organizationId);
      if (!team) {
        throw new ErrorResponse("Selected team not found in this organization", statusCode.Not_Found);
      }
      if (team.department.id !== currentDeptId) {
        throw new ErrorResponse("Selected team does not belong to employee's current department", statusCode.Bad_Request);
      }
    }

    // Handle avatar upload if new file provided
    let avatarUrlData: ImageType | undefined;
    if (avatarFile) {
      const uploadResult = await storageService.upload(
        {
          buffer: avatarFile.buffer,
          originalname: avatarFile.originalname,
          mimetype: avatarFile.mimetype,
          size: avatarFile.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/employees/avatars`,
          resourceType: "image",
        }
      );
      avatarUrlData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    return employeeRepo.update(
      id,
      organizationId,
      {
        ...data,
        ...(avatarUrlData ? { avatarUrl: avatarUrlData } : {}),
      },
      updatedById
    );
  }

  /**
   * Soft delete employee
   */
  async deleteEmployee(id: string, organizationId: string) {
    const existing = await employeeRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Employee not found", statusCode.Not_Found);
    }
    return employeeRepo.softDelete(id, organizationId);
  }

  /**
   * Get organizational hierarchy tree for an employee or root employees
   */
  async getHierarchyTree(organizationId: string, rootEmployeeId?: string) {
    if (rootEmployeeId) {
      const root = await employeeRepo.findById(rootEmployeeId, organizationId);
      if (!root) {
        throw new ErrorResponse("Root employee not found", statusCode.Not_Found);
      }
      return root;
    }

    // Return top-level leadership (employees without reporting managers)
    const topLevel = await prisma.employee.findMany({
      where: {
        organizationId,
        reportingManagerId: null,
        isDeleted: false,
      },
      include: {
        subordinates: {
          where: { isDeleted: false },
          include: {
            subordinates: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    return topLevel;
  }
}

export const employeeService = new EmployeeService();
