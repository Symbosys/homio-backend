import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateTeamInput,
  UpdateTeamInput,
  GetTeamsQueryInput,
} from "../validators/team.validator.js";

export class TeamRepository {
  /**
   * Create a new team under a department
   */
  async create(organizationId: string, departmentId: string, data: CreateTeamInput, createdById?: string) {
    const { name, code, description, teamLeadId, status } = data;

    return prisma.team.create({
      data: {
        organizationId,
        departmentId,
        name,
        code,
        description,
        teamLeadId,
        status: status || "ACTIVE",
        createdById,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teamLead: {
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
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Find team by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.team.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teamLead: {
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
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Find team by code within a department
   */
  async findByCode(code: string, departmentId: string) {
    return prisma.team.findFirst({
      where: {
        code: code.toUpperCase(),
        departmentId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find team by name within a department
   */
  async findByName(name: string, departmentId: string) {
    return prisma.team.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        departmentId,
        isDeleted: false,
      },
    });
  }

  /**
   * List teams with pagination and optional department filter
   */
  async findAll(organizationId: string, filters: GetTeamsQueryInput) {
    const { page, limit, departmentId, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.TeamWhereInput = {
      organizationId,
      isDeleted: false,
      ...(departmentId && { departmentId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          teamLead: {
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
              employeeAssignments: true,
            },
          },
        },
      }),
      prisma.team.count({ where }),
    ]);

    return {
      teams,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find all teams for a specific department
   */
  async findByDepartment(departmentId: string, organizationId: string) {
    return prisma.team.findMany({
      where: {
        departmentId,
        organizationId,
        isDeleted: false,
      },
      include: {
        teamLead: {
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
            employeeAssignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Update team
   */
  async update(id: string, organizationId: string, data: UpdateTeamInput, updatedById?: string) {
    return prisma.team.update({
      where: { id },
      data: {
        ...data,
        updatedById,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teamLead: {
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
            employeeAssignments: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete team
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.team.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }

  /**
   * Get all members assigned to a team
   */
  async getTeamMembers(teamId: string, organizationId: string) {
    const assignments = await prisma.employeeDepartmentTeam.findMany({
      where: {
        teamId,
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
      },
      orderBy: { createdAt: "asc" },
    });

    return assignments.map((a) => ({
      ...a.employee,
      role: a.role,
      assignmentId: a.id,
    }));
  }
}

export const teamRepo = new TeamRepository();
