import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  OnboardOrganizationInput,
  UpdateOrganizationInput,
  AssignSubscriptionInput,
} from "../validators/organization.validator.js";

export class OrganizationRepository {
  /**
   * Atomically onboard an organization, its subscription, and optional initial admin user
   */
  async onboard(
    data: OnboardOrganizationInput,
    dates: {
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      trialEndsAt: Date | null;
    },
    adminPasswordHash?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const { logoUrl, ...orgFields } = data.organization;
      const organization = await tx.organization.create({
        data: {
          ...orgFields,
          ...(logoUrl !== undefined && logoUrl !== null
            ? { logoUrl: logoUrl as Prisma.InputJsonValue }
            : {}),
          status: "ACTIVE",
        },
      });

      // 2. Create Initial Subscription
      const subscription = await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: data.subscription.planId,
          billingCycle: data.subscription.billingCycle,
          status: data.subscription.status,
          currentPeriodStart: dates.currentPeriodStart,
          currentPeriodEnd: dates.currentPeriodEnd,
          trialEndsAt: dates.trialEndsAt,
          externalId: data.subscription.externalId || null,
        },
        include: {
          plan: {
            include: {
              planFeature: true,
            },
          },
        },
      });

      // 3. Create Admin User (if provided)
      let adminUser = null;
      if (data.adminUser && adminPasswordHash) {
        adminUser = await tx.user.create({
          data: {
            email: data.adminUser.email,
            passwordHash: adminPasswordHash,
            firstName: data.adminUser.firstName,
            lastName: data.adminUser.lastName || null,
            phone: data.adminUser.phone || null,
            userType: "ADMIN",
            status: "ACTIVE",
            organizationId: organization.id,
            emailVerifiedAt: new Date(),
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
            createdAt: true,
          },
        });
      }

      return {
        ...organization,
        activeSubscription: subscription,
        adminUser,
      };
    });
  }

  /**
   * Find paginated organizations, including active subscription and user count
   */
  async findAll(options?: {
    skip?: number;
    take?: number;
    search?: string;
    status?: any;
  }) {
    const { skip = 0, take = 10, search, status } = options || {};

    const where: any = {
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { legalName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [organizations, total] = await prisma.$transaction([
      prisma.organization.findMany({
        where,
        skip,
        take,
        include: {
          subscriptions: {
            where: {
              status: {
                in: ["ACTIVE", "TRIALING"],
              },
            },
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              plan: {
                include: {
                  planFeature: true,
                },
              },
            },
          },
          _count: {
            select: {
              users: {
                where: {
                  isDeleted: false,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.organization.count({ where }),
    ]);

    return { organizations, total };
  }

  /**
   * Find a single organization by ID with full details, users, and subscriptions
   */
  async findById(id: string) {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            plan: {
              include: {
                planFeature: true,
              },
            },
          },
        },
        users: {
          where: {
            isDeleted: false,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            userType: true,
            status: true,
            createdAt: true,
            lastLoginAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            users: {
              where: {
                isDeleted: false,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find organization by slug
   */
  async findBySlug(slug: string) {
    return prisma.organization.findUnique({
      where: { slug },
    });
  }

  /**
   * Update organization details
   */
  async update(id: string, data: UpdateOrganizationInput) {
    const { logoUrl, ...fields } = data;
    return prisma.organization.update({
      where: { id },
      data: {
        ...fields,
        ...(logoUrl !== undefined
          ? { logoUrl: logoUrl === null ? Prisma.JsonNull : (logoUrl as Prisma.InputJsonValue) }
          : {}),
      },
    });
  }

  /**
   * Update organization status
   */
  async updateStatus(id: string, status: any) {
    return prisma.organization.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Assign or upgrade a subscription plan for an organization
   */
  async assignSubscription(
    organizationId: string,
    data: AssignSubscriptionInput,
    dates: {
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      trialEndsAt: Date | null;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // Expire / cancel any existing active or trialing subscriptions
      await tx.subscription.updateMany({
        where: {
          organizationId,
          status: {
            in: ["ACTIVE", "TRIALING"],
          },
        },
        data: {
          status: "CANCELED",
          cancelledAt: new Date(),
        },
      });

      // Create new active subscription
      const newSubscription = await tx.subscription.create({
        data: {
          organizationId,
          planId: data.planId,
          billingCycle: data.billingCycle,
          status: data.status,
          currentPeriodStart: dates.currentPeriodStart,
          currentPeriodEnd: dates.currentPeriodEnd,
          trialEndsAt: dates.trialEndsAt,
          externalId: data.externalId || null,
        },
        include: {
          plan: {
            include: {
              planFeature: true,
            },
          },
        },
      });

      return newSubscription;
    });
  }
}

export const organizationRepo = new OrganizationRepository();
