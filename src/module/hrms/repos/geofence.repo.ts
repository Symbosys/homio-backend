import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateGeofenceInput,
  UpdateGeofenceInput,
  GetGeofencesQueryInput,
} from "../validators/geofence.validator.js";

export class GeofenceRepository {
  /**
   * Create a new geofence area
   */
  async create(organizationId: string, data: CreateGeofenceInput, createdById?: string) {
    const { latitude, longitude, radiusMeters, ...rest } = data;

    return prisma.geofenceArea.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        latitude: new Prisma.Decimal(latitude),
        longitude: new Prisma.Decimal(longitude),
        radiusMeters: radiusMeters ?? 100,
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
   * Find geofence by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.geofenceArea.findFirst({
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
            punchInAttendances: true,
            punchOutAttendances: true,
          },
        },
      },
    });
  }

  /**
   * Find geofence by code scoped to tenant
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.geofenceArea.findFirst({
      where: {
        code: code.toUpperCase(),
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all geofences with pagination and search
   */
  async findAll(organizationId: string, filters: GetGeofencesQueryInput) {
    const { page, limit, search, status, sortBy, sortOrder } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.GeofenceAreaWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status && { status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { address: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [geofences, total] = await Promise.all([
      prisma.geofenceArea.findMany({
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
      prisma.geofenceArea.count({ where }),
    ]);

    return {
      geofences,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update geofence area
   */
  async update(id: string, organizationId: string, data: UpdateGeofenceInput, updatedById?: string) {
    const { latitude, longitude, radiusMeters, ...rest } = data;

    return prisma.geofenceArea.update({
      where: { id },
      data: {
        ...rest,
        updatedById,
        ...(latitude !== undefined && { latitude: new Prisma.Decimal(latitude) }),
        ...(longitude !== undefined && { longitude: new Prisma.Decimal(longitude) }),
        ...(radiusMeters !== undefined && { radiusMeters }),
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
   * Soft delete geofence
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.geofenceArea.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }

  /**
   * Assign or unassign employees to/from geofence
   */
  async assignEmployees(id: string, employeeIds: string[], action: "ASSIGN" | "UNASSIGN") {
    if (action === "ASSIGN") {
      return prisma.geofenceArea.update({
        where: { id },
        data: {
          employees: {
            connect: employeeIds.map((empId) => ({ id: empId })),
          },
        },
        include: {
          _count: {
            select: { employees: { where: { isDeleted: false } } },
          },
        },
      });
    } else {
      return prisma.geofenceArea.update({
        where: { id },
        data: {
          employees: {
            disconnect: employeeIds.map((empId) => ({ id: empId })),
          },
        },
        include: {
          _count: {
            select: { employees: { where: { isDeleted: false } } },
          },
        },
      });
    }
  }

  /**
   * Get all active geofences assigned to a specific employee
   */
  async getGeofencesForEmployee(employeeId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        organizationId,
        isDeleted: false,
      },
      select: {
        id: true,
        allowAttendanceFromAnywhere: true,
        geofences: {
          where: {
            isDeleted: false,
            status: "ACTIVE",
          },
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            latitude: true,
            longitude: true,
            radiusMeters: true,
            status: true,
          },
        },
      },
    });

    return employee;
  }
}

export const geofenceRepo = new GeofenceRepository();
