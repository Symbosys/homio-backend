import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateShiftInput,
  UpdateShiftInput,
  GetShiftsQueryInput,
} from "../validators/shift.validator.js";

export class ShiftRepository {
  /**
   * Create a new shift
   */
  async create(organizationId: string, data: CreateShiftInput, createdById?: string) {
    return prisma.shift.create({
      data: {
        ...data,
        organizationId,
        createdById,
      },
      include: {
        _count: {
          select: {
            employees: { where: { isDeleted: false } },
          },
        },
      },
    });
  }

  /**
   * Find shift by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.shift.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        employees: {
          where: { isDeleted: false },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            avatarUrl: true,
            employmentStatus: true,
          },
        },
        _count: {
          select: {
            employees: { where: { isDeleted: false } },
            attendances: true,
          },
        },
      },
    });
  }

  /**
   * Find shift by code scoped to tenant
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.shift.findFirst({
      where: {
        code: code.toUpperCase(),
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all shifts with pagination and filters
   */
  async findAll(organizationId: string, filters: GetShiftsQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.ShiftWhereInput = {
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

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              employees: { where: { isDeleted: false } },
            },
          },
        },
      }),
      prisma.shift.count({ where }),
    ]);

    return {
      shifts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update shift
   */
  async update(id: string, organizationId: string, data: UpdateShiftInput, updatedById?: string) {
    return prisma.shift.update({
      where: { id },
      data: {
        ...data,
        updatedById,
      },
      include: {
        _count: {
          select: {
            employees: { where: { isDeleted: false } },
          },
        },
      },
    });
  }

  /**
   * Soft delete shift
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.shift.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }

  /**
   * Bulk assign employees to shift
   */
  async assignEmployees(id: string, organizationId: string, employeeIds: string[]) {
    return prisma.employee.updateMany({
      where: {
        id: { in: employeeIds },
        organizationId,
        isDeleted: false,
      },
      data: {
        shiftId: id,
      },
    });
  }

  /**
   * Unassign single employee from shift
   */
  async unassignEmployee(employeeId: string, organizationId: string) {
    return prisma.employee.update({
      where: {
        id: employeeId,
        organizationId,
      },
      data: {
        shiftId: null,
      },
    });
  }
}

export const shiftRepo = new ShiftRepository();
