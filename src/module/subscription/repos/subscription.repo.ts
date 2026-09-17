import { prisma } from "../../../lib/prisma.js";
import type { CreatePlanInput, UpdatePlanInput } from "../validators/subscription.validator.js";

export class SubscriptionRepository {
  /**
   * Create a new subscription plan with its associated feature limits
   */
  async create(data: CreatePlanInput) {
    const { planFeature, ...planData } = data;

    return prisma.subscriptionPlan.create({
      data: {
        ...planData,
        planFeature: {
          create: {
            maxUser: planFeature.maxUser,
            maxEmployee: planFeature.maxEmployee,
          },
        },
      },
      include: {
        planFeature: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });
  }

  /**
   * Find all subscription plans (unpaginated) with their feature limits
   */
  async findAll(includeInactive = false) {
    return prisma.subscriptionPlan.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        planFeature: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });
  }

  /**
   * Find a single subscription plan by ID
   */
  async findById(id: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        planFeature: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });
  }

  /**
   * Find a subscription plan by its slug
   */
  async findBySlug(slug: string) {
    return prisma.subscriptionPlan.findUnique({
      where: { slug },
      include: {
        planFeature: true,
      },
    });
  }

  /**
   * Update a subscription plan and its feature limits
   */
  async update(id: string, data: UpdatePlanInput) {
    const { planFeature, ...planData } = data;

    return prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...planData,
        ...(planFeature
          ? {
              planFeature: {
                upsert: {
                  create: {
                    maxUser: planFeature.maxUser ?? 5,
                    maxEmployee: planFeature.maxEmployee ?? 10,
                  },
                  update: {
                    ...(planFeature.maxUser !== undefined && { maxUser: planFeature.maxUser }),
                    ...(planFeature.maxEmployee !== undefined && { maxEmployee: planFeature.maxEmployee }),
                  },
                },
              },
            }
          : {}),
      },
      include: {
        planFeature: true,
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });
  }

  /**
   * Delete a subscription plan
   */
  async delete(id: string) {
    return prisma.subscriptionPlan.delete({
      where: { id },
    });
  }

  /**
   * Check whether a plan has active or trialing subscriptions
   */
  async countActiveSubscriptions(planId: string) {
    return prisma.subscription.count({
      where: {
        planId,
        status: {
          in: ["ACTIVE", "TRIALING"],
        },
      },
    });
  }
}

export const subscriptionRepo = new SubscriptionRepository();
