import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  GetEmployeesQueryInput,
} from "../validators/employee.validator.js";

export type CreateEmployeeRepoInput = Omit<CreateEmployeeInput, "employeeCode"> & {
  employeeCode: string;
};

export function formatEmployeeWithDeptTeam<T extends { departmentAssignments?: any[] }>(emp: T | null) {
  if (!emp) return emp;
  const assignment = emp.departmentAssignments?.[0];
  return {
    ...emp,
    department: assignment?.department || null,
    team: assignment?.team || null,
    departmentRole: assignment?.role || null,
  };
}

export class EmployeeRepository {
  /**
   * Create a new employee within an organization with optional department & team assignment
   */
  async create(organizationId: string, data: CreateEmployeeRepoInput, createdById?: string) {
    const {
      avatarUrl,
      documents,
      dateOfBirth,
      joiningDate,
      probationEndDate,
      confirmationDate,
      departmentId,
      teamId,
      departmentRole,
      ...directFields
    } = data;

    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          ...directFields,
          organizationId,
          createdById,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          joiningDate: new Date(joiningDate),
          probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
          confirmationDate: confirmationDate ? new Date(confirmationDate) : null,
          avatarUrl: avatarUrl ? (avatarUrl as Prisma.InputJsonValue) : Prisma.JsonNull,
          documents: documents ? (documents as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              userType: true,
            },
          },
          reportingManager: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              workEmail: true,
            },
          },
        },
      });

      if (departmentId) {
        await tx.employeeDepartmentTeam.create({
          data: {
            organizationId,
            employeeId: employee.id,
            departmentId,
            teamId: teamId || null,
            role: departmentRole || "MEMBER",
            createdById,
          },
        });
      }

      // Re-fetch populated assignment
      const assignment = departmentId
        ? await tx.employeeDepartmentTeam.findFirst({
            where: { employeeId: employee.id, organizationId },
            include: {
              department: { select: { id: true, name: true, code: true } },
              team: { select: { id: true, name: true, code: true } },
            },
          })
        : null;

      return {
        ...employee,
        department: assignment?.department || null,
        team: assignment?.team || null,
        departmentRole: assignment?.role || null,
        departmentAssignments: assignment ? [assignment] : [],
      };
    });
  }

  /**
   * Get employee by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            userType: true,
          },
        },
        reportingManager: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
          },
        },
        subordinates: {
          where: { isDeleted: false },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            employmentStatus: true,
            workEmail: true,
          },
        },
        salaries: {
          where: { isDeleted: false, isCurrent: true },
          take: 1,
        },
        departmentAssignments: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return formatEmployeeWithDeptTeam(employee);
  }

  /**
   * Find employee by employeeCode within tenant
   */
  async findByEmployeeCode(employeeCode: string, organizationId: string) {
    return prisma.employee.findFirst({
      where: {
        employeeCode,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find all employees for an organization with filtering, search, and pagination
   */
  async findAll(organizationId: string, query: GetEmployeesQueryInput) {
    const {
      page,
      limit,
      search,
      status,
      employmentType,
      reportingManagerId,
      departmentId,
      teamId,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status ? { employmentStatus: status } : {}),
      ...(employmentType ? { employmentType } : {}),
      ...(reportingManagerId ? { reportingManagerId } : {}),
      ...(departmentId || teamId
        ? {
            departmentAssignments: {
              some: {
                ...(departmentId ? { departmentId } : {}),
                ...(teamId ? { teamId } : {}),
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { employeeCode: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { workEmail: { contains: search, mode: "insensitive" } },
              { workPhone: { contains: search } },
              { designation: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rawItems] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          reportingManager: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          salaries: {
            where: { isDeleted: false, isCurrent: true },
            select: {
              id: true,
              annualCtc: true,
              monthlyGross: true,
              currency: true,
              effectiveFrom: true,
              isCurrent: true,
            },
            take: 1,
          },
          departmentAssignments: {
            include: {
              department: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              team: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = rawItems.map((emp) => formatEmployeeWithDeptTeam(emp));

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update an employee profile and sync department & team assignment
   */
  async update(id: string, organizationId: string, data: UpdateEmployeeInput, updatedById?: string) {
    const {
      avatarUrl,
      documents,
      dateOfBirth,
      joiningDate,
      probationEndDate,
      confirmationDate,
      resignationDate,
      noticePeriodEndDate,
      relievingDate,
      terminationDate,
      departmentId,
      teamId,
      departmentRole,
      ...directFields
    } = data;

    return prisma.$transaction(async (tx) => {
      const updatedEmployee = await tx.employee.update({
        where: { id },
        data: {
          ...directFields,
          updatedById,
          ...(dateOfBirth !== undefined ? { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null } : {}),
          ...(joiningDate !== undefined ? { joiningDate: new Date(joiningDate) } : {}),
          ...(probationEndDate !== undefined ? { probationEndDate: probationEndDate ? new Date(probationEndDate) : null } : {}),
          ...(confirmationDate !== undefined ? { confirmationDate: confirmationDate ? new Date(confirmationDate) : null } : {}),
          ...(resignationDate !== undefined ? { resignationDate: resignationDate ? new Date(resignationDate) : null } : {}),
          ...(noticePeriodEndDate !== undefined ? { noticePeriodEndDate: noticePeriodEndDate ? new Date(noticePeriodEndDate) : null } : {}),
          ...(relievingDate !== undefined ? { relievingDate: relievingDate ? new Date(relievingDate) : null } : {}),
          ...(terminationDate !== undefined ? { terminationDate: terminationDate ? new Date(terminationDate) : null } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl ? (avatarUrl as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
          ...(documents !== undefined ? { documents: documents ? (documents as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
        },
        include: {
          reportingManager: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
        },
      });

      // Synchronize Department & Team assignment
      if (departmentId !== undefined) {
        if (departmentId === null) {
          // Explicitly clear assignment
          await tx.employeeDepartmentTeam.deleteMany({
            where: { employeeId: id, organizationId },
          });
        } else {
          // Upsert assignment for employee
          const existingAssignment = await tx.employeeDepartmentTeam.findFirst({
            where: { employeeId: id, organizationId },
          });

          if (existingAssignment) {
            await tx.employeeDepartmentTeam.update({
              where: { id: existingAssignment.id },
              data: {
                departmentId,
                teamId: teamId !== undefined ? teamId : existingAssignment.teamId,
                ...(departmentRole ? { role: departmentRole } : {}),
                updatedById,
              },
            });
          } else {
            await tx.employeeDepartmentTeam.create({
              data: {
                organizationId,
                employeeId: id,
                departmentId,
                teamId: teamId || null,
                role: departmentRole || "MEMBER",
                createdById: updatedById,
              },
            });
          }
        }
      } else if (teamId !== undefined) {
        // Team ID updated without changing department
        const existingAssignment = await tx.employeeDepartmentTeam.findFirst({
          where: { employeeId: id, organizationId },
        });

        if (existingAssignment) {
          await tx.employeeDepartmentTeam.update({
            where: { id: existingAssignment.id },
            data: {
              teamId: teamId || null,
              ...(departmentRole ? { role: departmentRole } : {}),
              updatedById,
            },
          });
        }
      }

      const assignment = await tx.employeeDepartmentTeam.findFirst({
        where: { employeeId: id, organizationId },
        include: {
          department: { select: { id: true, name: true, code: true } },
          team: { select: { id: true, name: true, code: true } },
        },
      });

      return {
        ...updatedEmployee,
        department: assignment?.department || null,
        team: assignment?.team || null,
        departmentRole: assignment?.role || null,
        departmentAssignments: assignment ? [assignment] : [],
      };
    });
  }

  /**
   * Soft delete employee
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.employee.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Count total employees in organization (used for sequential code generation)
   */
  async countEmployees(organizationId: string) {
    return prisma.employee.count({
      where: { organizationId },
    });
  }
}

export const employeeRepo = new EmployeeRepository();
