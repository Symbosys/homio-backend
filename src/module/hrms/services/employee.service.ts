import bcrypt from "bcryptjs";
import { employeeRepo } from "../repos/employee.repo.js";
import { departmentRepo } from "../repos/department.repo.js";
import { teamRepo } from "../repos/team.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
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
   * Create an employee with optional user login account, avatar upload and tenant validations
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

    // 2. Validate Employee Profile Email & Phone Uniqueness (Independent of SaaS User)
    if (data.workEmail && data.workEmail.trim()) {
      const existingWorkEmail = await prisma.employee.findFirst({
        where: { organizationId, workEmail: data.workEmail.trim().toLowerCase(), isDeleted: false },
      });
      if (existingWorkEmail) {
        throw new ErrorResponse(
          `An employee with work email "${data.workEmail}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (data.personalEmail && data.personalEmail.trim()) {
      const existingPersonalEmail = await prisma.employee.findFirst({
        where: { organizationId, personalEmail: data.personalEmail.trim().toLowerCase(), isDeleted: false },
      });
      if (existingPersonalEmail) {
        throw new ErrorResponse(
          `An employee with personal email "${data.personalEmail}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (data.workPhone && data.workPhone.trim()) {
      const existingWorkPhone = await prisma.employee.findFirst({
        where: { organizationId, workPhone: data.workPhone.trim(), isDeleted: false },
      });
      if (existingWorkPhone) {
        throw new ErrorResponse(
          `An employee with work phone "${data.workPhone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (data.personalPhone && data.personalPhone.trim()) {
      const existingPersonalPhone = await prisma.employee.findFirst({
        where: { organizationId, personalPhone: data.personalPhone.trim(), isDeleted: false },
      });
      if (existingPersonalPhone) {
        throw new ErrorResponse(
          `An employee with personal phone "${data.personalPhone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    // 3. Handle SaaS User Login Account Creation or Linkage (Purely based on User section)
    if (data.createUserAccount || data.userPassword) {
      const loginEmail = data.userEmail?.trim().toLowerCase();

      if (!loginEmail) {
        throw new ErrorResponse(
          "A valid login email address is required in the User Account section to create portal access",
          statusCode.Bad_Request
        );
      }

      if (!data.userPassword || data.userPassword.trim().length < 6) {
        throw new ErrorResponse(
          "A password of at least 6 characters is required to create a user login account",
          statusCode.Bad_Request
        );
      }

      // Check if user email already registered in SaaS users table
      const existingUser = await userRepo.findByEmail(loginEmail);
      if (existingUser) {
        throw new ErrorResponse(
          `A user account with login email "${loginEmail}" already exists`,
          statusCode.Conflict
        );
      }

      // Check user phone if provided in User section
      const loginPhone = data.userPhone?.trim() || null;
      if (loginPhone) {
        const existingPhoneUser = await prisma.user.findFirst({
          where: { phone: loginPhone, isDeleted: false },
        });
        if (existingPhoneUser) {
          throw new ErrorResponse(
            `A user account with phone number "${loginPhone}" already exists`,
            statusCode.Conflict
          );
        }
      }

      // Validate roles if provided
      if (data.userRoleIds && data.userRoleIds.length > 0) {
        const rolesInOrg = await prisma.role.findMany({
          where: { id: { in: data.userRoleIds }, organizationId },
          select: { id: true },
        });
        if (rolesInOrg.length !== data.userRoleIds.length) {
          throw new ErrorResponse("One or more selected roles are invalid for this organization", statusCode.Bad_Request);
        }
      }

      // Hash password and create User
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.userPassword.trim(), salt);

      const createdUser = await userRepo.create({
        organizationId,
        email: loginEmail,
        passwordHash,
        firstName: data.firstName.trim(),
        lastName: data.lastName ? data.lastName.trim() : null,
        phone: loginPhone,
        status: data.userStatus || "ACTIVE",
        userType: data.userType || "USER",
        invitedById: createdById,
        roleIds: data.userRoleIds && data.userRoleIds.length > 0 ? data.userRoleIds : undefined,
      });

      data.userId = createdUser.id;
    } else if (data.userId) {
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
   * Update employee profile and sync user credentials / login access
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

    // Validate Employee Profile Email & Phone Uniqueness on Update
    if (data.workEmail && data.workEmail.trim() !== existing.workEmail) {
      const existingWorkEmail = await prisma.employee.findFirst({
        where: { organizationId, workEmail: data.workEmail.trim().toLowerCase(), id: { not: id }, isDeleted: false },
      });
      if (existingWorkEmail) {
        throw new ErrorResponse(`An employee with work email "${data.workEmail}" already exists in this organization`, statusCode.Conflict);
      }
    }

    if (data.personalEmail && data.personalEmail.trim() !== existing.personalEmail) {
      const existingPersonalEmail = await prisma.employee.findFirst({
        where: { organizationId, personalEmail: data.personalEmail.trim().toLowerCase(), id: { not: id }, isDeleted: false },
      });
      if (existingPersonalEmail) {
        throw new ErrorResponse(`An employee with personal email "${data.personalEmail}" already exists in this organization`, statusCode.Conflict);
      }
    }

    if (data.workPhone && data.workPhone.trim() !== existing.workPhone) {
      const existingWorkPhone = await prisma.employee.findFirst({
        where: { organizationId, workPhone: data.workPhone.trim(), id: { not: id }, isDeleted: false },
      });
      if (existingWorkPhone) {
        throw new ErrorResponse(`An employee with work phone "${data.workPhone}" already exists in this organization`, statusCode.Conflict);
      }
    }

    if (data.personalPhone && data.personalPhone.trim() !== existing.personalPhone) {
      const existingPersonalPhone = await prisma.employee.findFirst({
        where: { organizationId, personalPhone: data.personalPhone.trim(), id: { not: id }, isDeleted: false },
      });
      if (existingPersonalPhone) {
        throw new ErrorResponse(`An employee with personal phone "${data.personalPhone}" already exists in this organization`, statusCode.Conflict);
      }
    }

    // Handle User account creation or updates (Independent of Employee Profile email/phone)
    if (existing.userId) {
      // 1. Password update
      if (data.userPassword && data.userPassword.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(data.userPassword.trim(), salt);
        await prisma.user.update({
          where: { id: existing.userId },
          data: { passwordHash, passwordChangedAt: new Date() },
        });
      }

      // 2. Email update
      if (data.userEmail) {
        const newEmail = data.userEmail.trim().toLowerCase();
        const currentUser = await prisma.user.findUnique({ where: { id: existing.userId } });
        if (currentUser && currentUser.email !== newEmail) {
          const duplicate = await userRepo.findByEmail(newEmail);
          if (duplicate && duplicate.id !== existing.userId) {
            throw new ErrorResponse(`A user account with login email "${newEmail}" already exists`, statusCode.Conflict);
          }
          await prisma.user.update({
            where: { id: existing.userId },
            data: { email: newEmail },
          });
        }
      }

      // 3. User Phone update
      if (data.userPhone !== undefined) {
        const newPhone = data.userPhone ? data.userPhone.trim() : null;
        if (newPhone) {
          const duplicatePhone = await prisma.user.findFirst({
            where: { phone: newPhone, id: { not: existing.userId }, isDeleted: false },
          });
          if (duplicatePhone) {
            throw new ErrorResponse(`A user account with phone number "${newPhone}" already exists`, statusCode.Conflict);
          }
        }
        await prisma.user.update({
          where: { id: existing.userId },
          data: { phone: newPhone },
        });
      }

      // 4. Status or UserType update
      if (data.userStatus || data.userType) {
        await prisma.user.update({
          where: { id: existing.userId },
          data: {
            ...(data.userStatus ? { status: data.userStatus } : {}),
            ...(data.userType ? { userType: data.userType } : {}),
          },
        });
      }

      // 5. Role synchronization
      if (data.userRoleIds !== undefined) {
        await prisma.userRole.deleteMany({
          where: { userId: existing.userId },
        });
        if (data.userRoleIds && data.userRoleIds.length > 0) {
          await prisma.userRole.createMany({
            data: data.userRoleIds.map((roleId) => ({
              userId: existing.userId!,
              roleId,
              assignedById: updatedById,
            })),
          });
        }
      }
    } else if (data.createUserAccount || data.userPassword) {
      // Create new user account for existing employee
      const loginEmail = data.userEmail?.trim().toLowerCase();

      if (!loginEmail) {
        throw new ErrorResponse(
          "A valid login email address is required in the User Account section to create portal access",
          statusCode.Bad_Request
        );
      }

      if (!data.userPassword || data.userPassword.trim().length < 6) {
        throw new ErrorResponse(
          "A password of at least 6 characters is required to create a user login account",
          statusCode.Bad_Request
        );
      }

      const existingUser = await userRepo.findByEmail(loginEmail);
      if (existingUser) {
        throw new ErrorResponse(`A user account with login email "${loginEmail}" already exists`, statusCode.Conflict);
      }

      const loginPhone = data.userPhone?.trim() || null;
      if (loginPhone) {
        const existingPhoneUser = await prisma.user.findFirst({
          where: { phone: loginPhone, isDeleted: false },
        });
        if (existingPhoneUser) {
          throw new ErrorResponse(`A user account with phone number "${loginPhone}" already exists`, statusCode.Conflict);
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.userPassword.trim(), salt);

      const createdUser = await userRepo.create({
        organizationId,
        email: loginEmail,
        passwordHash,
        firstName: (data.firstName || existing.firstName).trim(),
        lastName: (data.lastName !== undefined ? data.lastName : existing.lastName)?.trim() || null,
        phone: loginPhone,
        status: data.userStatus || "ACTIVE",
        userType: data.userType || "USER",
        invitedById: updatedById,
        roleIds: data.userRoleIds && data.userRoleIds.length > 0 ? data.userRoleIds : undefined,
      });

      data.userId = createdUser.id;
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
