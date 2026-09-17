import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { subscriptionService } from "../services/subscription.service.js";
import {
  createPlanSchema,
  updatePlanSchema,
  planIdParamSchema,
} from "../validators/subscription.validator.js";

/**
 * Controller: Create a new subscription plan with features (PLATFORM_ADMIN)
 */
export const createPlan = asyncHandler(async (req, res) => {
  const parsed = createPlanSchema.parse({ body: req.body });
  const plan = await subscriptionService.createPlan(parsed.body);
  return SuccessResponse(res, "Subscription plan created successfully", plan, statusCode.Created);
});

/**
 * Controller: Get all subscription plans without pagination (PLATFORM_ADMIN)
 */
export const getAllPlans = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive !== "false";
  const result = await subscriptionService.getAllPlans(includeInactive);
  return SuccessResponse(res, "Subscription plans retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single subscription plan by ID (PLATFORM_ADMIN)
 */
export const getPlanById = asyncHandler(async (req, res) => {
  const parsed = planIdParamSchema.parse({ params: req.params });
  const plan = await subscriptionService.getPlanById(parsed.params.id);
  return SuccessResponse(res, "Subscription plan details retrieved successfully", plan, statusCode.OK);
});

/**
 * Controller: Update subscription plan and feature limits (PLATFORM_ADMIN)
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const parsed = updatePlanSchema.parse({ params: req.params, body: req.body });
  const plan = await subscriptionService.updatePlan(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Subscription plan updated successfully", plan, statusCode.OK);
});

/**
 * Controller: Toggle plan active status (PLATFORM_ADMIN)
 */
export const togglePlanStatus = asyncHandler(async (req, res) => {
  const parsed = planIdParamSchema.parse({ params: req.params });
  const plan = await subscriptionService.togglePlanStatus(parsed.params.id);
  return SuccessResponse(res, "Subscription plan status updated successfully", plan, statusCode.OK);
});

/**
 * Controller: Delete subscription plan (PLATFORM_ADMIN)
 */
export const deletePlan = asyncHandler(async (req, res) => {
  const parsed = planIdParamSchema.parse({ params: req.params });
  const result = await subscriptionService.deletePlan(parsed.params.id);
  return SuccessResponse(res, result.message, null, statusCode.OK);
});
