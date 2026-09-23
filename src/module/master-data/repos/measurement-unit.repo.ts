import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateMeasurementUnitInput,
  UpdateMeasurementUnitInput,
  GetMeasurementUnitsQuery,
} from "../validators/measurement-unit.validator.js";

export class MeasurementUnitRepository {
  /**
   * Create a new MeasurementUnit
   */
  async create(organizationId: string, data: CreateMeasurementUnitInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.measurementUnit.create({
      data: {
        name: data.name,
        symbol: data.symbol,
        code: data.code,
        type: data.type as any,
        description: data.description,
        precision: data.precision,
        conversionFactor: data.conversionFactor !== undefined && data.conversionFactor !== null ? new Prisma.Decimal(data.conversionFactor) : undefined,
        baseUnitSymbol: data.baseUnitSymbol,
        isDefault: data.isDefault,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        additionalInformation: data.additionalInformation as any,
        organizationId,
      },
    });
  }

  /**
   * Find paginated list of measurement units for an organization
   */
  async findAll(organizationId: string, query: GetMeasurementUnitsQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { page = 1, limit = 50, search, type, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MeasurementUnitWhereInput = {
      organizationId,
      isDeleted: false,
      ...(type && { type: type as any }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { symbol: { contains: search, mode: "insensitive" } },
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      db.measurementUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      db.measurementUnit.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single unit by ID
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.measurementUnit.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find by name within organization
   */
  async findByName(name: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.measurementUnit.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Find by symbol within organization
   */
  async findBySymbol(symbol: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.measurementUnit.findFirst({
      where: {
        organizationId,
        symbol: { equals: symbol, mode: "insensitive" },
        isDeleted: false,
      },
    });
  }

  /**
   * Update measurement unit
   */
  async update(id: string, organizationId: string, data: UpdateMeasurementUnitInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const updateData: Prisma.MeasurementUnitUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.symbol !== undefined && { symbol: data.symbol }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.type !== undefined && { type: data.type as any }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.precision !== undefined && { precision: data.precision }),
      ...(data.conversionFactor !== undefined && {
        conversionFactor: data.conversionFactor !== null ? new Prisma.Decimal(data.conversionFactor) : null,
      }),
      ...(data.baseUnitSymbol !== undefined && { baseUnitSymbol: data.baseUnitSymbol }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.additionalInformation !== undefined && { additionalInformation: data.additionalInformation as any }),
    };

    return db.measurementUnit.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Soft delete measurement unit
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.measurementUnit.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const unit = await this.findById(id, organizationId, tx);
    if (!unit) return null;

    const db = tx || prisma;
    return db.measurementUnit.update({
      where: { id },
      data: { isActive: !unit.isActive },
    });
  }
}

export const measurementUnitRepo = new MeasurementUnitRepository();
