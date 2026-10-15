import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateLabourInput,
  UpdateLabourInput,
  GetLaboursQuery,
  PlatformGetLaboursQuery,
} from "../validators/labour.validator.js";

/**
 * Repository layer for Labour entity operations
 * Enforces tenant isolation using organizationId on all queries
 */
export class LabourRepo {
  /**
   * Helper to safely format JSON values for Prisma
   */
  private formatJsonValue(
    val: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create a new labour profile with optional nested KYC record
   * @param organizationId - Tenant organization UUID (optional for independent platform labours)
   * @param data - Validated labour creation input
   * @param tx - Optional transaction client
   */
  async create(
    organizationId: string | undefined | null,
    data: CreateLabourInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      kyc,
      dailyRate,
      hourlyRate,
      photoUrl,
      aadhaarDoc,
      additionalInformation,
      createUserAccount,
      userEmail,
      userPhone,
      userPassword,
      userRoleIds,
      userStatus,
      userType,
      ...labourData
    } = data;

    const labour = await db.labour.create({
      data: {
        ...labourData,
        dailyRate: new Prisma.Decimal(dailyRate),
        hourlyRate:
          hourlyRate !== undefined && hourlyRate !== null
            ? new Prisma.Decimal(hourlyRate)
            : undefined,
        photoUrl: this.formatJsonValue(photoUrl),
        aadhaarDoc: this.formatJsonValue(aadhaarDoc),
        additionalInformation: this.formatJsonValue(additionalInformation),
        organizationId: organizationId || undefined,
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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        kycDocument: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            userType: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return labour;
  }

  /**
   * Find paginated list of labours scoped to organization or platform with multi-field search and filters
   * @param organizationId - Tenant organization UUID (optional for platform admin)
   * @param query - Validated query parameters
   * @param tx - Optional transaction client
   */
  async findAll(
    organizationId: string | undefined | null,
    query: GetLaboursQuery & { scope?: "ALL" | "PLATFORM_ONLY" | "ORG_ONLY" },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      search,
      trade,
      state,
      city,
      locality,
      isKycVerified,
      isAvailable,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
      scope,
    } = query;
    const skip = (page - 1) * limit;

    let orgFilter: Prisma.LabourWhereInput = {};
    if (scope === "PLATFORM_ONLY") {
      orgFilter = { organizationId: null };
    } else if (scope === "ORG_ONLY") {
      if (organizationId) {
        orgFilter = { organizationId };
      } else {
        orgFilter = { organizationId: { not: null } };
      }
    } else {
      if (organizationId) {
        orgFilter = { organizationId };
      }
    }

    const andConditions: Prisma.LabourWhereInput[] = [
      orgFilter,
      { isDeleted: false },
    ];
    if (trade)
      andConditions.push({ trade: { equals: trade, mode: "insensitive" } });
    if (state)
      andConditions.push({ state: { equals: state, mode: "insensitive" } });
    if (city)
      andConditions.push({ city: { equals: city, mode: "insensitive" } });
    if (locality)
      andConditions.push({
        locality: { contains: locality, mode: "insensitive" },
      });
    if (status)
      andConditions.push({ status: { equals: status as any } });
    if (isAvailable !== undefined) andConditions.push({ isAvailable });
    if (isKycVerified !== undefined) {
      if (isKycVerified) {
        andConditions.push({
          OR: [
            { isKycVerified: true },
            { kycDocument: { status: "APPROVED" } },
          ],
        });
      } else {
        andConditions.push({
          isKycVerified: false,
          NOT: { kycDocument: { status: "APPROVED" } },
        });
      }
    }
    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { trade: { contains: search, mode: "insensitive" } },
          { state: { contains: search, mode: "insensitive" } },
          { city: { contains: search, mode: "insensitive" } },
          { locality: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.LabourWhereInput = { AND: andConditions };

    const [total, items] = await Promise.all([
      db.labour.count({ where }),
      db.labour.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
          kycDocument: true,
          user: {
            select: {
              id: true,
              email: true,
              status: true,
              userType: true,
              roles: {
                include: {
                  role: {
                    select: {
                      id: true,
                      name: true,
                      slug: true,
                    },
                  },
                },
              },
            },
          },
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
   * @param organizationId - Tenant organization UUID (optional for platform admin)
   * @param tx - Optional transaction client
   */
  async findById(
    id: string,
    organizationId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.labour.findFirst({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
        isDeleted: false,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        kycDocument: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            userType: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
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
  async update(
    id: string,
    organizationId: string | undefined | null,
    data: UpdateLabourInput,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      kyc,
      dailyRate,
      hourlyRate,
      photoUrl,
      aadhaarDoc,
      additionalInformation,
      createUserAccount,
      userEmail,
      userPhone,
      userPassword,
      userRoleIds,
      userStatus,
      userType,
      ...labourData
    } = data;

    const updateData: Prisma.LabourUpdateInput = {
      ...labourData,
      ...(dailyRate !== undefined && {
        dailyRate: new Prisma.Decimal(dailyRate),
      }),
      ...(hourlyRate !== undefined && {
        hourlyRate: hourlyRate !== null ? new Prisma.Decimal(hourlyRate) : null,
      }),
      ...(photoUrl !== undefined && {
        photoUrl: this.formatJsonValue(photoUrl),
      }),
      ...(aadhaarDoc !== undefined && {
        aadhaarDoc: this.formatJsonValue(aadhaarDoc),
      }),
      ...(additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(additionalInformation),
      }),
    };

    if (kyc) {
      const kycData = {
        ...kyc,
        ...(kyc.aadhaarDoc !== undefined && {
          aadhaarDoc: this.formatJsonValue(kyc.aadhaarDoc),
        }),
        ...(kyc.selfiePhoto !== undefined && {
          selfiePhoto: this.formatJsonValue(kyc.selfiePhoto),
        }),
        ...(kyc.policeClearanceDoc !== undefined && {
          policeClearanceDoc: this.formatJsonValue(kyc.policeClearanceDoc),
        }),
      };

      updateData.kycDocument = {
        upsert: {
          create:
            kycData as unknown as Prisma.LabourKycDocumentCreateWithoutLabourInput,
          update:
            kycData as unknown as Prisma.LabourKycDocumentUpdateWithoutLabourInput,
        },
      };
    }

    return db.labour.update({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      data: updateData,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        kycDocument: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            userType: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Soft delete labour profile within organization
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID (optional for platform admin)
   * @param tx - Optional transaction client
   */
  async softDelete(
    id: string,
    organizationId?: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.labour.update({
      where: {
        id,
        ...(organizationId ? { organizationId } : {}),
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const labourRepo = new LabourRepo();
