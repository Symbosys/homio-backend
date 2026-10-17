import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourBookingsQuery } from "../validators/labour-booking.validator.js";

/**
 * Labour Booking Repository
 * Handles DB operations for labour bookings/assignments under both:
 * 1. Organization Project Services (B2B tenant interior design projects)
 * 2. Direct Platform Marketplace (B2C on-demand home service bookings)
 */
export class LabourBookingRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Generates multiple sequential booking numbers (e.g. SB-2026-0001, SB-2026-0002...)
   */
  async generateBookingNumbers(prefix: string = "LB", countToGenerate: number = 1): Promise<string[]> {
    const currentYear = new Date().getFullYear();
    const count = await prisma.labourBooking.count({
      where: {
        bookingNumber: { startsWith: `${prefix}-${currentYear}` },
      },
    });
    const results: string[] = [];
    for (let i = 1; i <= countToGenerate; i++) {
      results.push(`${prefix}-${currentYear}-${String(count + i).padStart(4, "0")}`);
    }
    return results;
  }

  /**
   * Generates next sequential booking number (e.g. LB-2026-0001 for Org Project, SB-2026-0001 for Marketplace Service Booking)
   */
  async generateBookingNumber(prefix: string = "LB", projectId?: string | null): Promise<string> {
    const numbers = await this.generateBookingNumbers(prefix, 1);
    return numbers[0]!;
  }

  /**
   * Create new booking
   */
  async create(data: any) {
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const endDate = data.endDate ? new Date(data.endDate) : startDate;

    const formattedData = {
      ...data,
      startDate,
      endDate,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
      ...(data.taskChecklist !== undefined && {
        taskChecklist: this.formatJsonValue(data.taskChecklist),
      }),
      ...(data.proofPhotos !== undefined && {
        proofPhotos: this.formatJsonValue(data.proofPhotos),
      }),
    };

    return prisma.labourBooking.create({
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            skillLevel: true,
            photoUrl: true,
            dailyRate: true,
            locality: true,
            city: true,
            state: true,
            isKycVerified: true,
            averageRating: true,
            userId: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            clientRating: true,
            clientDuesCount: true,
            isBlacklisted: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find booking by ID with optional tenant/client/worker verification
   */
  async findById(
    id: string,
    scope?:
      | string
      | null
      | {
          organizationId?: string | null;
          clientId?: string | null;
          workerLabourId?: string | null;
          workerUserId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const normalizedScope =
      typeof scope === "string"
        ? { organizationId: scope }
        : scope === null
        ? {}
        : scope;

    const andConditions: Prisma.LabourBookingWhereInput[] = [
      { id, isDeleted: false },
    ];

    if (normalizedScope && !normalizedScope.isPlatformAdmin) {
      if (normalizedScope.organizationId) {
        andConditions.push({
          OR: [
            { organizationId: normalizedScope.organizationId },
            { project: { organizationId: normalizedScope.organizationId } },
          ],
        });
      }

      if (normalizedScope.clientId) {
        andConditions.push({ clientId: normalizedScope.clientId });
      }

      if (normalizedScope.workerLabourId) {
        andConditions.push({ labourId: normalizedScope.workerLabourId });
      }

      if (normalizedScope.workerUserId) {
        andConditions.push({ labour: { userId: normalizedScope.workerUserId } });
      }
    }

    return prisma.labourBooking.findFirst({
      where: { AND: andConditions },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            skillLevel: true,
            photoUrl: true,
            dailyRate: true,
            locality: true,
            city: true,
            state: true,
            isKycVerified: true,
            averageRating: true,
            warningCount: true,
            isBlacklisted: true,
            userId: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            clientRating: true,
            clientDuesCount: true,
            isBlacklisted: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
          },
        },
        ratings: {
          select: {
            id: true,
            rating: true,
            reviewNotes: true,
            qualityScore: true,
            punctualityScore: true,
            behaviourScore: true,
            reviewerRole: true,
            createdAt: true,
          },
        },
        disputes: {
          select: {
            id: true,
            disputeType: true,
            reason: true,
            status: true,
            lawyerAssigned: true,
            lawyerName: true,
            labourCourtFiled: true,
            createdAt: true,
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amount: true,
            daysCount: true,
            paymentDate: true,
            paymentMethod: true,
            transactionRef: true,
            receiptPhoto: true,
            status: true,
            remarks: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            attendances: true,
            payments: true,
            ratings: true,
            disputes: true,
          },
        },
      },
    });
  }

  /**
   * List paginated bookings with flexible filters across B2B and B2C channels
   */
  async findAll(
    query: GetLabourBookingsQuery,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      workerLabourId?: string | null;
      workerUserId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    const {
      page,
      limit,
      channel,
      clientId,
      projectId,
      projectServiceId,
      labourId,
      locality,
      city,
      state,
      status,
      search,
      trade,
      startDate,
      endDate,
      from,
      to,
      date,
    } = query;
    const skip = (page - 1) * limit;

    const andConditions: Prisma.LabourBookingWhereInput[] = [
      { isDeleted: false },
    ];

    // Scoping constraints
    if (scope && !scope.isPlatformAdmin) {
      if (scope.organizationId) {
        andConditions.push({
          OR: [
            { organizationId: scope.organizationId },
            { project: { organizationId: scope.organizationId } },
          ],
        });
      }

      if (scope.clientId) {
        andConditions.push({ clientId: scope.clientId });
      }

      if (scope.workerLabourId) {
        andConditions.push({ labourId: scope.workerLabourId });
      }

      if (scope.workerUserId) {
        andConditions.push({
          OR: [
            { labour: { userId: scope.workerUserId } },
            { labourId: scope.workerUserId },
          ],
        });
      }
    }

    // Direct query filters
    if (channel) andConditions.push({ channel });
    if (clientId) andConditions.push({ clientId });
    if (projectId) andConditions.push({ projectId });
    if (projectServiceId) andConditions.push({ projectServiceId });
    if (labourId) andConditions.push({ labourId });
    if (status) andConditions.push({ status });
    if (locality) andConditions.push({ locality: { contains: locality, mode: "insensitive" } });
    if (city) andConditions.push({ city: { equals: city, mode: "insensitive" } });
    if (state) andConditions.push({ state: { equals: state, mode: "insensitive" } });

    if (trade) {
      andConditions.push({
        OR: [
          { labour: { trade: { equals: trade, mode: "insensitive" } } },
          { projectService: { category: { equals: trade, mode: "insensitive" } } },
        ],
      });
    }

    if (date) {
      const targetDate = new Date(date);
      if (!isNaN(targetDate.getTime())) {
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        andConditions.push({
          startDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        });
      }
    } else {
      if (startDate || from) {
        const fromDate = new Date((startDate || from)!);
        if (!isNaN(fromDate.getTime())) {
          andConditions.push({ startDate: { gte: fromDate } });
        }
      }
      if (endDate || to) {
        const toDate = new Date((endDate || to)!);
        if (!isNaN(toDate.getTime())) {
          toDate.setHours(23, 59, 59, 999);
          andConditions.push({ startDate: { lte: toDate } });
        }
      }
    }

    if (search) {
      andConditions.push({
        OR: [
          { bookingNumber: { contains: search, mode: "insensitive" } },
          { workTitle: { contains: search, mode: "insensitive" } },
          { labour: { name: { contains: search, mode: "insensitive" } } },
          {
            client: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          },
          { projectService: { title: { contains: search, mode: "insensitive" } } },
          { locality: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const where: Prisma.LabourBookingWhereInput = { AND: andConditions };

    const [total, bookings] = await Promise.all([
      prisma.labourBooking.count({ where }),
      prisma.labourBooking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              phone: true,
              trade: true,
              photoUrl: true,
              locality: true,
              city: true,
              state: true,
              isKycVerified: true,
              averageRating: true,
            },
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              clientRating: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
            },
          },
          projectService: {
            select: {
              id: true,
              serviceCode: true,
              title: true,
              category: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      bookings,
      items: bookings,
    };
  }

  /**
   * Update booking
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
      ...(data.taskChecklist !== undefined && {
        taskChecklist: this.formatJsonValue(data.taskChecklist),
      }),
      ...(data.proofPhotos !== undefined && {
        proofPhotos: this.formatJsonValue(data.proofPhotos),
      }),
    };

    return prisma.labourBooking.update({
      where: { id },
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            skillLevel: true,
            photoUrl: true,
            dailyRate: true,
            locality: true,
            city: true,
            state: true,
            isKycVerified: true,
            averageRating: true,
            warningCount: true,
            isBlacklisted: true,
            userId: true,
          },
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            clientRating: true,
            clientDuesCount: true,
            isBlacklisted: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            projectCode: true,
            site: true,
          },
        },
        projectService: {
          select: {
            id: true,
            serviceCode: true,
            title: true,
            category: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete booking
   */
  async softDelete(id: string) {
    return prisma.labourBooking.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Find all verified, available, unallocated labours in a given state, city, and category
   */
  async findAvailableLaboursInRegion(state: string, city: string, category: string, excludeLabourId?: string) {
    return prisma.labour.findMany({
      where: {
        isDeleted: false,
        isBlacklisted: false,
        ...(excludeLabourId ? { id: { not: excludeLabourId } } : {}),
        state: { equals: state.trim(), mode: "insensitive" },
        city: { equals: city.trim(), mode: "insensitive" },
        trade: { equals: category.trim(), mode: "insensitive" },
        status: "AVAILABLE",
        isAvailable: true,
        OR: [
          { isKycVerified: true },
          { kycDocument: { status: "APPROVED" } },
        ],
        bookings: {
          none: {
            isDeleted: false,
            status: { in: ["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"] },
          },
        },
      },
    });
  }

  /**
   * Get or initialize platform labour settings singleton
   */
  async getPlatformSetting() {
    let setting = await prisma.platformLabourSetting.findFirst();
    if (!setting) {
      setting = await prisma.platformLabourSetting.create({
        data: {
          autoAssignLabour: true,
          platformCommissionRate: 10.00,
          cooldownPeriodDays: 3,
          consecutiveRejectionsThreshold: 3,
          delayReportMinHours: 24,
        },
      });
    }
    return setting;
  }

  /**
   * Update platform labour settings
   */
  async updatePlatformSetting(data: {
    autoAssignLabour?: boolean;
    platformCommissionRate?: number | any;
    cooldownPeriodDays?: number;
    consecutiveRejectionsThreshold?: number;
    delayReportMinHours?: number;
    updatedById?: string;
  }) {
    const current = await this.getPlatformSetting();
    return prisma.platformLabourSetting.update({
      where: { id: current.id },
      data,
    });
  }

  /**
   * Get user category cooldown status
   */
  async getUserCategoryCooldown(userId: string, category: string) {
    return prisma.userLabourCategoryCooldown.findUnique({
      where: { userId_category: { userId, category: category.trim() } },
    });
  }

  /**
   * Upsert user category cooldown
   */
  async upsertUserCategoryCooldown(
    userId: string,
    category: string,
    data: {
      rejectionCount?: number;
      isLocked?: boolean;
      lockedUntil?: Date | null;
      lastRejectedAt?: Date;
      rejectionLogs?: any;
    }
  ) {
    return prisma.userLabourCategoryCooldown.upsert({
      where: { userId_category: { userId, category: category.trim() } },
      update: {
        ...data,
        ...(data.rejectionLogs !== undefined && {
          rejectionLogs: this.formatJsonValue(data.rejectionLogs),
        }),
      },
      create: {
        userId,
        category: category.trim(),
        rejectionCount: data.rejectionCount ?? 0,
        isLocked: data.isLocked ?? false,
        lockedUntil: data.lockedUntil ?? null,
        lastRejectedAt: data.lastRejectedAt ?? new Date(),
        rejectionLogs: this.formatJsonValue(data.rejectionLogs ?? []),
      },
    });
  }
}

export const labourBookingRepo = new LabourBookingRepo();
