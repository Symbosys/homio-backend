import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
  GetLeaveTypesQueryInput,
} from "../validators/leave-type.validator.js";

export class LeaveTypeRepository {
  /**
   * Create leave type
   */
  async create(organizationId: string, data: CreateLeaveTypeInput, createdById?: string) {
    const { daysAllowedPerYear, maxCarryForwardDays, ...rest } = data;

    return prisma.leaveType.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        daysAllowedPerYear: new Prisma.Decimal(daysAllowedPerYear),
        maxCarryForwardDays:
          maxCarryForwardDays !== undefined && maxCarryForwardDays !== null
            ? new Prisma.Decimal(maxCarryForwardDays)
            : null,
      },
      include: {
        _count: {
          select: { leaveRequests: true },
        },
      },
    });
  }

  /**
   * Find by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.leaveType.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        _count: {
          select: { leaveRequests: true },
        },
      },
    });
  }

  /**
   * Find by code scoped to tenant
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.leaveType.findFirst({
      where: {
        code: code.toUpperCase(),
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find by name scoped to tenant
   */
  async findByName(name: string, organizationId: string) {
    return prisma.leaveType.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all leave types with filters
   */
  async findAll(organizationId: string, filters: GetLeaveTypesQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.LeaveTypeWhereInput = {
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

    const [leaveTypes, total] = await Promise.all([
      prisma.leaveType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { leaveRequests: true },
          },
        },
      }),
      prisma.leaveType.count({ where }),
    ]);

    return {
      leaveTypes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update leave type
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateLeaveTypeInput,
    updatedById?: string
  ) {
    const { daysAllowedPerYear, maxCarryForwardDays, ...rest } = data;

    return prisma.leaveType.update({
      where: { id },
      data: {
        ...rest,
        updatedById,
        ...(daysAllowedPerYear !== undefined && {
          daysAllowedPerYear: new Prisma.Decimal(daysAllowedPerYear),
        }),
        ...(maxCarryForwardDays !== undefined && {
          maxCarryForwardDays:
            maxCarryForwardDays !== null ? new Prisma.Decimal(maxCarryForwardDays) : null,
        }),
      },
    });
  }

  /**
   * Soft delete leave type
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.leaveType.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }
}

export const leaveTypeRepo = new LeaveTypeRepository();
