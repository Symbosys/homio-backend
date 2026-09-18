import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
  GetDepartmentsQueryInput,
} from "../validators/department.validator.js";

export class DepartmentRepository {
  /**
   * Create a new department
   */
  async create(organizationId: string, data: CreateDepartmentInput, createdById?: string) {
    const { budget, ...rest } = data;

    return prisma.department.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        budget: budget !== undefined && budget !== null ? new Prisma.Decimal(budget) : null,
      },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            teams: { where: { isDeleted: false } },
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Find department by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.department.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
          },
        },
        teams: {
          where: { isDeleted: false },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            description: true,
            teamLead: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
            _count: {
              select: {
                employeeAssignments: true,
              },
            },
          },
        },
        _count: {
          select: {
            teams: { where: { isDeleted: false } },
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Find department by code scoped to tenant
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.department.findFirst({
      where: {
        code: code.toUpperCase(),
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find department by name scoped to tenant
   */
  async findByName(name: string, organizationId: string) {
    return prisma.department.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all departments with pagination and filters
   */
  async findAll(organizationId: string, filters: GetDepartmentsQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.DepartmentWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          headOfDepartment: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              teams: { where: { isDeleted: false } },
              employeeAssignments: true,
            },
          },
        },
      }),
      prisma.department.count({ where }),
    ]);

    return {
      departments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update department
   */
  async update(id: string, organizationId: string, data: UpdateDepartmentInput, updatedById?: string) {
    const { budget, ...rest } = data;

    return prisma.department.update({
      where: { id },
      data: {
        ...rest,
        updatedById,
        ...(budget !== undefined && {
          budget: budget !== null ? new Prisma.Decimal(budget) : null,
        }),
      },
      include: {
        headOfDepartment: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            teams: { where: { isDeleted: false } },
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete department
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.department.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }

  /**
   * Get all members assigned to a department
   */
  async getDepartmentMembers(departmentId: string, organizationId: string) {
    const assignments = await prisma.employeeDepartmentTeam.findMany({
      where: {
        departmentId,
        organizationId,
        employee: { isDeleted: false },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            workEmail: true,
            employmentStatus: true,
            joiningDate: true,
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
      orderBy: { createdAt: "asc" },
    });

    return assignments.map((a) => ({
      ...a.employee,
      role: a.role,
      team: a.team,
      assignmentId: a.id,
    }));
  }
}

export const departmentRepo = new DepartmentRepository();
