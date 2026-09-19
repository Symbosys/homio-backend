import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateTravelInput,
  UpdateTravelInput,
  GetTravelsQueryInput,
  UpdateTravelExpensesInput,
} from "../validators/travel.validator.js";

export class TravelRepository {
  /**
   * Create a field travel trip
   */
  async create(
    organizationId: string,
    data: CreateTravelInput,
    documents?: any,
    createdById?: string
  ) {
    const { employeeIds, estimatedBudget, startDate, endDate, ...rest } = data;

    const connectEmployees =
      employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0
        ? { connect: employeeIds.map((id) => ({ id })) }
        : undefined;

    return prisma.fieldTravel.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        estimatedBudget: estimatedBudget !== undefined && estimatedBudget !== null ? new Prisma.Decimal(estimatedBudget) : null,
        documents: documents || undefined,
        employees: connectEmployees,
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
          },
        },
        _count: {
          select: { employees: { where: { isDeleted: false } } },
        },
      },
    });
  }

  /**
   * Find travel by ID scoped to tenant
   */
  async findById(id: string, organizationId: string) {
    return prisma.fieldTravel.findFirst({
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
            workPhone: true,
            workEmail: true,
          },
        },
      },
    });
  }

  /**
   * Find travel by code scoped to tenant
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.fieldTravel.findFirst({
      where: {
        code: code.toUpperCase(),
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all field travels with pagination and filters
   */
  async findAll(organizationId: string, filters: GetTravelsQueryInput) {
    const {
      page,
      limit,
      search,
      status,
      destination,
      startDate,
      endDate,
      employeeId,
      sortBy,
      sortOrder,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.FieldTravelWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status && { status }),
      ...(destination && { destination: { contains: destination, mode: "insensitive" } }),
      ...(employeeId && {
        employees: {
          some: { id: employeeId },
        },
      }),
      ...(startDate &&
        endDate && {
          startDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
          endDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
        }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { destination: { contains: search, mode: "insensitive" } },
          { purpose: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [travels, total] = await Promise.all([
      prisma.fieldTravel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          employees: {
            where: { isDeleted: false },
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: { employees: { where: { isDeleted: false } } },
          },
        },
      }),
      prisma.fieldTravel.count({ where }),
    ]);

    return {
      travels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List travels for specific employee
   */
  async findByEmployee(
    employeeId: string,
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.FieldTravelWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status && { status }),
      employees: {
        some: { id: employeeId },
      },
    };

    const [travels, total] = await Promise.all([
      prisma.fieldTravel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: "desc" },
        include: {
          employees: {
            where: { isDeleted: false },
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.fieldTravel.count({ where }),
    ]);

    return {
      travels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update field travel
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateTravelInput,
    updatedById?: string
  ) {
    const { estimatedBudget, actualExpenses, startDate, endDate, ...rest } = data;

    return prisma.fieldTravel.update({
      where: { id },
      data: {
        ...rest,
        updatedById,
        ...(startDate && { startDate: new Date(`${startDate}T00:00:00.000Z`) }),
        ...(endDate && { endDate: new Date(`${endDate}T00:00:00.000Z`) }),
        ...(estimatedBudget !== undefined && {
          estimatedBudget: estimatedBudget !== null ? new Prisma.Decimal(estimatedBudget) : null,
        }),
        ...(actualExpenses !== undefined && {
          actualExpenses: actualExpenses !== null ? new Prisma.Decimal(actualExpenses) : null,
        }),
      },
      include: {
        employees: {
          where: { isDeleted: false },
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete field travel
   */
  async softDelete(id: string, organizationId: string, updatedById?: string) {
    return prisma.fieldTravel.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedById,
      },
    });
  }

  /**
   * Bulk assign/unassign employees to travel
   */
  async assignEmployees(id: string, employeeIds: string[], action: "ASSIGN" | "UNASSIGN") {
    if (action === "ASSIGN") {
      return prisma.fieldTravel.update({
        where: { id },
        data: {
          employees: {
            connect: employeeIds.map((empId) => ({ id: empId })),
          },
        },
        include: {
          employees: {
            where: { isDeleted: false },
            select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });
    } else {
      return prisma.fieldTravel.update({
        where: { id },
        data: {
          employees: {
            disconnect: employeeIds.map((empId) => ({ id: empId })),
          },
        },
        include: {
          employees: {
            where: { isDeleted: false },
            select: { id: true, employeeCode: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });
    }
  }

  /**
   * Update actual expenses & documents
   */
  async updateExpenses(
    id: string,
    organizationId: string,
    data: UpdateTravelExpensesInput,
    newDocuments?: any,
    updatedById?: string
  ) {
    const existing = await prisma.fieldTravel.findUnique({
      where: { id },
      select: { documents: true },
    });

    let combinedDocuments = existing?.documents;
    if (newDocuments && Array.isArray(newDocuments) && newDocuments.length > 0) {
      const existingDocs = Array.isArray(existing?.documents) ? (existing.documents as any[]) : [];
      combinedDocuments = [...existingDocs, ...newDocuments];
    }

    return prisma.fieldTravel.update({
      where: { id },
      data: {
        actualExpenses: new Prisma.Decimal(data.actualExpenses),
        currency: data.currency || "INR",
        ...(data.remarks && { remarks: data.remarks }),
        ...(combinedDocuments && { documents: combinedDocuments }),
        updatedById,
      },
    });
  }

  /**
   * Update travel status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    remarks?: string | null,
    updatedById?: string
  ) {
    return prisma.fieldTravel.update({
      where: { id },
      data: {
        status,
        ...(remarks && { remarks }),
        updatedById,
      },
    });
  }
}

export const travelRepo = new TravelRepository();
