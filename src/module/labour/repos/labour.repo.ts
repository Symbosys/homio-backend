import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { CreateLabourInput, UpdateLabourInput, GetLaboursQuery } from "../validators/labour.validator.js";

/**
 * Repository layer for Labour entity operations
 * Enforces tenant isolation using organizationId on all queries
 */
export class LabourRepo {
  /**
   * Helper to safely format JSON values for Prisma
   */
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create a new labour profile with optional nested KYC record
   * @param organizationId - Tenant organization UUID
   * @param data - Validated labour creation input
   * @param tx - Optional transaction client
   */
  async create(organizationId: string, data: CreateLabourInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { kyc, dailyRate, hourlyRate, photoUrl, aadhaarDoc, additionalInformation, ...labourData } = data;

    const labour = await db.labour.create({
      data: {
        ...labourData,
        dailyRate: new Prisma.Decimal(dailyRate),
        hourlyRate: hourlyRate !== undefined && hourlyRate !== null ? new Prisma.Decimal(hourlyRate) : undefined,
        photoUrl: this.formatJsonValue(photoUrl),
        aadhaarDoc: this.formatJsonValue(aadhaarDoc),
        additionalInformation: this.formatJsonValue(additionalInformation),
        organizationId,
        ...(kyc && {
          kycDocument: {
            create: {
              ...kyc,
              aadhaarDoc: this.formatJsonValue(kyc.aadhaarDoc),
              selfiePhoto: this.formatJsonValue(kyc.selfiePhoto),
              policeClearanceDoc: this.formatJsonValue(kyc.policeClearanceDoc),
            },
          },
        }),
      },
      include: {
        kycDocument: true,
      },
    });

    return labour;
  }

  /**
   * Find paginated list of labours scoped to organization with multi-field search and filters
   * @param organizationId - Tenant organization UUID
   * @param query - Validated query parameters
   * @param tx - Optional transaction client
   */
  async findAll(organizationId: string, query: GetLaboursQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { search, trade, city, status, page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourWhereInput = {
      organizationId,
      isDeleted: false,
      ...(trade && { trade: { equals: trade, mode: "insensitive" } }),
      ...(city && { city: { equals: city, mode: "insensitive" } }),
      ...(status && { status: { equals: status, mode: "insensitive" } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { trade: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      db.labour.count({ where }),
      db.labour.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          kycDocument: true,
          _count: {
            select: {
              bookings: true,
              attendances: true,
              ratings: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single labour by ID with full KYC, bookings, attendances, ratings, and disputes
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   * @param tx - Optional transaction client
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    return db.labour.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        kycDocument: true,
        bookings: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
              },
            },
          },
        },
        attendances: {
          take: 15,
          orderBy: { attendanceDate: "desc" },
          include: {
            projectSite: {
              select: {
                id: true,
                siteName: true,
                city: true,
              },
            },
          },
        },
        ratings: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        disputes: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Update labour profile with partial/dirty update payload (Symmetric field editing)
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   * @param data - Validated labour update input
   * @param tx - Optional transaction client
   */
  async update(id: string, organizationId: string, data: UpdateLabourInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { kyc, dailyRate, hourlyRate, photoUrl, aadhaarDoc, additionalInformation, ...labourData } = data;

    const updateData: Prisma.LabourUpdateInput = {
      ...labourData,
      ...(dailyRate !== undefined && { dailyRate: new Prisma.Decimal(dailyRate) }),
      ...(hourlyRate !== undefined && {
        hourlyRate: hourlyRate !== null ? new Prisma.Decimal(hourlyRate) : null,
      }),
      ...(photoUrl !== undefined && { photoUrl: this.formatJsonValue(photoUrl) }),
      ...(aadhaarDoc !== undefined && { aadhaarDoc: this.formatJsonValue(aadhaarDoc) }),
      ...(additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(additionalInformation),
      }),
    };

    if (kyc) {
      const kycData = {
        ...kyc,
        ...(kyc.aadhaarDoc !== undefined && { aadhaarDoc: this.formatJsonValue(kyc.aadhaarDoc) }),
        ...(kyc.selfiePhoto !== undefined && { selfiePhoto: this.formatJsonValue(kyc.selfiePhoto) }),
        ...(kyc.policeClearanceDoc !== undefined && {
          policeClearanceDoc: this.formatJsonValue(kyc.policeClearanceDoc),
        }),
      };

      updateData.kycDocument = {
        upsert: {
          create: kycData as unknown as Prisma.LabourKycDocumentCreateWithoutLabourInput,
          update: kycData as unknown as Prisma.LabourKycDocumentUpdateWithoutLabourInput,
        },
      };
    }

    return db.labour.update({
      where: {
        id,
        organizationId,
      },
      data: updateData,
      include: {
        kycDocument: true,
      },
    });
  }

  /**
   * Soft delete labour profile within organization
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   * @param tx - Optional transaction client
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    return db.labour.update({
      where: {
        id,
        organizationId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const labourRepo = new LabourRepo();
