import { subscriptionRepo } from "../repos/subscription.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { CreatePlanInput, UpdatePlanInput } from "../validators/subscription.validator.js";

export class SubscriptionService {
  /**
   * Create a new subscription plan with feature limits
   */
  async createPlan(input: CreatePlanInput) {
    const normalizedSlug = input.slug.trim().toLowerCase();

    const existingBySlug = await subscriptionRepo.findBySlug(normalizedSlug);
    if (existingBySlug) {
      throw new ErrorResponse(
        `Subscription plan with slug '${normalizedSlug}' already exists`,
        statusCode.Conflict
      );
    }

    const plan = await subscriptionRepo.create({
      ...input,
      slug: normalizedSlug,
    });

    return plan;
  }

  /**
   * Retrieve all subscription plans (unpaginated)
   */
  async getAllPlans(includeInactive = true) {
    const plans = await subscriptionRepo.findAll(includeInactive);
    return {
      plans,
      total: plans.length,
    };
  }

  /**
   * Retrieve a single subscription plan by ID
   */
  async getPlanById(id: string) {
    const plan = await subscriptionRepo.findById(id);
    if (!plan) {
      throw new ErrorResponse("Subscription plan not found", statusCode.Not_Found);
    }
    return plan;
  }

  /**
   * Update an existing subscription plan and its feature limits
   */
  async updatePlan(id: string, input: UpdatePlanInput) {
    const existing = await subscriptionRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Subscription plan not found", statusCode.Not_Found);
    }

    if (input.slug) {
      const normalizedSlug = input.slug.trim().toLowerCase();
      if (normalizedSlug !== existing.slug) {
        const slugConflict = await subscriptionRepo.findBySlug(normalizedSlug);
        if (slugConflict && slugConflict.id !== id) {
          throw new ErrorResponse(
            `Subscription plan with slug '${normalizedSlug}' already exists`,
            statusCode.Conflict
          );
        }
        input.slug = normalizedSlug;
      }
    }

    const updated = await subscriptionRepo.update(id, input);
    return updated;
  }

  /**
   * Toggle a subscription plan's active status
   */
  async togglePlanStatus(id: string) {
    const existing = await subscriptionRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Subscription plan not found", statusCode.Not_Found);
    }

    const updated = await subscriptionRepo.update(id, {
      isActive: !existing.isActive,
    });

    return updated;
  }

  /**
   * Delete a subscription plan if it has no active or trialing subscriptions
   */
  async deletePlan(id: string) {
    const existing = await subscriptionRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Subscription plan not found", statusCode.Not_Found);
    }

    const activeCount = await subscriptionRepo.countActiveSubscriptions(id);
    if (activeCount > 0) {
      throw new ErrorResponse(
        `Cannot delete plan '${existing.name}' because it currently has ${activeCount} active/trialing subscription(s). Please deactivate the plan instead.`,
        statusCode.Bad_Request
      );
    }

    await subscriptionRepo.delete(id);
    return { message: "Subscription plan deleted successfully" };
  }
}

export const subscriptionService = new SubscriptionService();
